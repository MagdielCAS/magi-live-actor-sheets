package hub

import (
	"encoding/json"
	"time"

	"github.com/coder/websocket"

	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/authz"
	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/protocol"
)

// RegisterClient attaches a new client connection for actorID. It sends
// the cached snapshot for that actor if one exists, tells the client
// whether the bridge is online, and asks the bridge for a fresh snapshot.
// It returns a connection id for HandleClientMessage and UnregisterClient.
func (h *Hub) RegisterClient(conn *websocket.Conn, actorID string) string {
	id := h.newConnID("client")
	out := newOutConn(id, conn)

	h.mu.Lock()
	h.clients[id] = &clientConn{id: id, actorID: actorID, out: out}

	if snap, ok := h.snapshots[actorID]; ok {
		out.enqueue(protocol.Raw(protocol.TypeActorSnapshot, "", actorID, snap.Raw))
	}

	statePayload, _ := json.Marshal(protocol.BridgeState{Online: h.bridge != nil})
	out.enqueue(protocol.Raw(protocol.TypeBridgeState, "", "", statePayload))

	if h.bridge != nil {
		h.bridge.out.enqueue(protocol.Raw(protocol.TypeActorRequest, "", actorID, json.RawMessage(`{}`)))
	}

	h.updateSubscriptionsLocked()
	h.mu.Unlock()

	return id
}

// UnregisterClient detaches the client connection with the given id and
// drops any of its commands still waiting on the bridge.
func (h *Hub) UnregisterClient(id string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.clients[id]; !ok {
		return
	}
	delete(h.clients, id)

	for cmdID, pc := range h.pending {
		if pc.clientID == id {
			pc.timer.Stop()
			delete(h.pending, cmdID)
		}
	}
	h.updateSubscriptionsLocked()
}

// HandleClientMessage processes one envelope a client sent on connection
// id. It rewrites actor.* messages into the matching command.* message and
// forwards them to the bridge, using the actor of the connection; any
// actorId the client sent is ignored, as the protocol requires.
func (h *Hub) HandleClientMessage(id string, env protocol.Envelope) {
	h.mu.Lock()
	defer h.mu.Unlock()

	cs, ok := h.clients[id]
	if !ok {
		return
	}
	if env.V != protocol.Version {
		cs.out.closeWith(websocket.StatusProtocolError, "protocol version not supported")
		return
	}

	var cmdType string
	switch env.Type {
	case protocol.TypeActorPatch:
		cmdType = protocol.TypeCommandPatch
	case protocol.TypeActorRoll:
		cmdType = protocol.TypeCommandRoll
	case protocol.TypeActorUse:
		cmdType = protocol.TypeCommandUse
	case protocol.TypeActorChat:
		cmdType = protocol.TypeCommandChat
	default:
		return // The protocol says to discard a message with an unknown type.
	}

	h.forwardClientCommandLocked(cs, cmdType, env)
}

func (h *Hub) forwardClientCommandLocked(cs *clientConn, cmdType string, env protocol.Envelope) {
	if env.ID == "" {
		cs.out.enqueue(errorEnvelope("", "bad_request", "the command needs an id"))
		return
	}
	if cs.pendingCount >= maxPendingPerClient {
		cs.out.enqueue(errorEnvelope(env.ID, "busy", "too many commands are already waiting for a reply"))
		return
	}

	if cmdType == protocol.TypeCommandPatch {
		var patch protocol.CommandPatch
		if err := env.Decode(&patch); err != nil {
			cs.out.enqueue(errorEnvelope(env.ID, "bad_request", "the patch payload is not valid"))
			return
		}
		if err := authz.CheckPatch(patch.Target, patch.Changes); err != nil {
			cs.out.enqueue(errorEnvelope(env.ID, "forbidden", err.Error()))
			return
		}
	}

	if h.bridge == nil {
		cs.out.enqueue(errorEnvelope(env.ID, "offline", "the Foundry tab is not connected"))
		return
	}

	cmdID := h.newCmdID()
	h.bridge.out.enqueue(protocol.Raw(cmdType, cmdID, cs.actorID, env.Payload))

	cs.pendingCount++
	pc := &pendingCmd{clientID: cs.id, clientReqID: env.ID}
	pc.timer = time.AfterFunc(pendingTimeout, func() { h.timeoutPending(cmdID) })
	h.pending[cmdID] = pc
}

// updateSubscriptionsLocked recomputes the set of actors with a live
// client and tells the bridge only when that set changed. Call it with mu
// held.
func (h *Hub) updateSubscriptionsLocked() {
	if h.bridge == nil {
		return
	}
	current := h.currentSubscriptionsLocked()
	if setsEqual(current, h.lastSubs) {
		return
	}
	h.lastSubs = current

	payload, _ := json.Marshal(protocol.Subscriptions{ActorIDs: sortedKeys(current)})
	h.bridge.out.enqueue(protocol.Raw(protocol.TypeSubscriptionsSet, "", "", payload))
}

func (h *Hub) currentSubscriptionsLocked() map[string]struct{} {
	set := make(map[string]struct{}, len(h.clients))
	for _, cs := range h.clients {
		set[cs.actorID] = struct{}{}
	}
	return set
}

func setsEqual(a, b map[string]struct{}) bool {
	if len(a) != len(b) {
		return false
	}
	for k := range a {
		if _, ok := b[k]; !ok {
			return false
		}
	}
	return true
}
