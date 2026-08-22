package hub

import (
	"encoding/json"
	"sort"

	"github.com/coder/websocket"

	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/protocol"
)

// RegisterBridge attaches a new bridge connection. Only one bridge may be
// active at a time: if one is already registered, RegisterBridge closes it
// and every command still waiting on it fails. It returns a connection id
// for HandleBridgeMessage and UnregisterBridge.
//
// baseURL is the scheme and host the bridge used to reach the server (for
// example "https://example.com"). The hub uses it to build the URL in
// pairing.issued.
func (h *Hub) RegisterBridge(conn *websocket.Conn, hello protocol.BridgeHello, baseURL string) string {
	id := h.newConnID("bridge")
	out := newOutConn(id, conn)

	h.mu.Lock()
	old := h.bridge
	wasOnline := old != nil
	h.bridge = &bridgeConn{id: id, out: out, baseURL: baseURL}
	h.failAllPendingLocked("the Foundry tab reconnected")

	subs := h.currentSubscriptionsLocked()
	h.lastSubs = subs
	readyPayload, _ := json.Marshal(protocol.BridgeReady{Subscriptions: sortedKeys(subs)})
	out.enqueue(protocol.Raw(protocol.TypeBridgeReady, "", "", readyPayload))

	if !wasOnline {
		h.broadcastBridgeStateLocked(true)
	}
	h.mu.Unlock()

	if old != nil {
		old.out.closeWith(websocket.StatusNormalClosure, "replaced by a new bridge connection")
	}

	h.log.Info("bridge connected",
		"world", hello.WorldTitle,
		"system", hello.SystemID,
		"moduleVersion", hello.ModuleVersion,
	)
	return id
}

// UnregisterBridge detaches the bridge connection with the given id. It is
// a no-op if that connection was already replaced by a newer one.
func (h *Hub) UnregisterBridge(id string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.bridge == nil || h.bridge.id != id {
		return
	}
	h.bridge = nil
	h.knownActors = nil
	h.haveActors = false
	h.failAllPendingLocked("the Foundry tab disconnected")
	h.broadcastBridgeStateLocked(false)
	h.log.Info("bridge disconnected")
}

// HandleBridgeMessage processes one envelope the bridge sent on connection
// id. A message from a bridge connection that has since been replaced is
// ignored.
func (h *Hub) HandleBridgeMessage(id string, env protocol.Envelope) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.bridge == nil || h.bridge.id != id {
		return
	}
	if env.V != protocol.Version {
		h.bridge.out.closeWith(websocket.StatusProtocolError, "protocol version not supported")
		return
	}

	switch env.Type {
	case protocol.TypeActorList:
		h.handleActorListLocked(env)
	case protocol.TypeActorSnapshot:
		h.handleSnapshotLocked(env)
	case protocol.TypeCommandResult:
		h.handleCommandResultLocked(env)
	case protocol.TypePairingRequest:
		h.handlePairingRequestLocked(env)
	default:
		// The protocol says to discard a message with an unknown type.
	}
}

func (h *Hub) handleActorListLocked(env protocol.Envelope) {
	var list protocol.ActorList
	if err := env.Decode(&list); err != nil {
		h.log.Warn("bridge sent an actor.list the server cannot read", "error", err)
		return
	}
	h.knownActors = list.Actors
	h.haveActors = true
}

func (h *Hub) handleSnapshotLocked(env protocol.Envelope) {
	id, rev, err := protocol.ParseSnapshotMeta(env.Payload)
	if err != nil {
		h.log.Warn("bridge sent a snapshot the server cannot read", "error", err)
		return
	}

	actorID := env.ActorID
	if actorID == "" {
		actorID = id
	}
	if actorID == "" {
		h.log.Warn("bridge sent a snapshot with no actor id")
		return
	}

	if cached, ok := h.snapshots[actorID]; ok && rev <= cached.Rev {
		return
	}
	h.snapshots[actorID] = protocol.Snapshot{ActorID: actorID, Rev: rev, Raw: env.Payload}

	out := protocol.Raw(protocol.TypeActorSnapshot, "", actorID, env.Payload)
	for _, cs := range h.clients {
		if cs.actorID == actorID {
			cs.out.enqueue(out)
		}
	}
}

func (h *Hub) handleCommandResultLocked(env protocol.Envelope) {
	if env.ID == "" {
		return
	}
	pc, ok := h.pending[env.ID]
	if !ok {
		return // Already timed out, or the id is unknown.
	}
	delete(h.pending, env.ID)
	pc.timer.Stop()

	cs, haveClient := h.clients[pc.clientID]
	if haveClient {
		cs.pendingCount--
	}

	var result protocol.CommandResult
	if err := env.Decode(&result); err != nil {
		if haveClient {
			cs.out.enqueue(errorEnvelope(pc.clientReqID, "bad_gateway", "the Foundry tab sent a result the server cannot read"))
		}
		return
	}
	if !haveClient {
		return // The client disconnected before the answer arrived.
	}

	if result.Ok {
		payload, _ := json.Marshal(protocol.Ack{})
		cs.out.enqueue(protocol.Raw(protocol.TypeAck, pc.clientReqID, "", payload))
		return
	}

	code := result.Error
	if code == "" {
		code = "command_failed"
	}
	payload, _ := json.Marshal(protocol.ErrorPayload{Code: code, Message: result.Detail})
	cs.out.enqueue(protocol.Raw(protocol.TypeError, pc.clientReqID, "", payload))
}

func (h *Hub) handlePairingRequestLocked(env protocol.Envelope) {
	if env.ID == "" {
		return // No id means the server has no way to reply.
	}
	var req protocol.PairingRequest
	if err := env.Decode(&req); err != nil || req.ActorID == "" {
		h.bridge.out.enqueue(errorEnvelope(env.ID, "bad_request", "the pairing request is not valid"))
		return
	}

	code, expiresAt := h.pairing.Issue(req.ActorID)
	issued := protocol.PairingIssued{
		Code:      code,
		URL:       h.bridge.baseURL + "/?code=" + code,
		ExpiresAt: expiresAt,
	}
	payload, _ := json.Marshal(issued)
	h.bridge.out.enqueue(protocol.Raw(protocol.TypePairingIssued, env.ID, "", payload))
}

// timeoutPending fails one command that the bridge did not answer in time.
// It is called from a time.AfterFunc goroutine.
func (h *Hub) timeoutPending(cmdID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	pc, ok := h.pending[cmdID]
	if !ok {
		return // Already resolved.
	}
	delete(h.pending, cmdID)

	cs, ok := h.clients[pc.clientID]
	if !ok {
		return
	}
	cs.pendingCount--
	cs.out.enqueue(errorEnvelope(pc.clientReqID, "timeout", "the Foundry tab did not answer in time"))
}

// failAllPendingLocked fails every command waiting on the bridge, for
// example because the bridge disconnected. Call it with mu held.
func (h *Hub) failAllPendingLocked(reason string) {
	for cmdID, pc := range h.pending {
		pc.timer.Stop()
		delete(h.pending, cmdID)
		if cs, ok := h.clients[pc.clientID]; ok {
			cs.pendingCount--
			cs.out.enqueue(errorEnvelope(pc.clientReqID, "offline", reason))
		}
	}
}

// broadcastBridgeStateLocked tells every client whether the bridge is
// online. Call it with mu held.
func (h *Hub) broadcastBridgeStateLocked(online bool) {
	payload, _ := json.Marshal(protocol.BridgeState{Online: online})
	env := protocol.Raw(protocol.TypeBridgeState, "", "", payload)
	for _, cs := range h.clients {
		cs.out.enqueue(env)
	}
}

func sortedKeys(set map[string]struct{}) []string {
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
