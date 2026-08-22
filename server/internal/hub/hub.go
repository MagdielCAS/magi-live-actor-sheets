// Package hub is the core of the relay. One Hub holds the single bridge
// connection, the set of client connections, and the per-actor snapshot
// cache. It routes client commands to the bridge and bridge snapshots to
// clients.
//
// The httpapi package owns connection accept, admission, and the read
// loop for each connection. It calls into the Hub for every message. The
// Hub owns each connection's outbound queue and write loop (see conn.go),
// and never performs network I/O itself while holding its lock.
package hub

import (
	"encoding/json"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/pairing"
	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/protocol"
)

// maxPendingPerClient bounds how many commands one client may have in
// flight at once, so one flooding client cannot exhaust server memory.
const maxPendingPerClient = 32

// pendingTimeout bounds how long the hub waits for the bridge to answer a
// command before it fails the command back to the client.
const pendingTimeout = 10 * time.Second

// bridgeConn is the hub's view of the single bridge connection.
type bridgeConn struct {
	id      string
	out     *outConn
	baseURL string
}

// clientConn is the hub's view of one client connection.
type clientConn struct {
	id           string
	actorID      string
	out          *outConn
	pendingCount int
}

// pendingCmd tracks one command forwarded to the bridge, so the hub can
// route the eventual command.result back to the right client.
type pendingCmd struct {
	clientID    string
	clientReqID string
	timer       *time.Timer
}

// Hub is the core relay state. A Hub is safe for concurrent use.
type Hub struct {
	log     *slog.Logger
	pairing *pairing.Store

	connSeq atomic.Uint64
	cmdSeq  atomic.Uint64

	mu          sync.Mutex
	bridge      *bridgeConn
	clients     map[string]*clientConn
	snapshots   map[string]protocol.Snapshot
	knownActors []protocol.ActorSummary
	haveActors  bool
	pending     map[string]*pendingCmd
	lastSubs    map[string]struct{}
}

// New makes an empty Hub. store issues pairing codes on the bridge's
// behalf.
func New(log *slog.Logger, store *pairing.Store) *Hub {
	return &Hub{
		log:       log,
		pairing:   store,
		clients:   make(map[string]*clientConn),
		snapshots: make(map[string]protocol.Snapshot),
		pending:   make(map[string]*pendingCmd),
		lastSubs:  make(map[string]struct{}),
	}
}

// KnownActors returns the actor list the bridge last announced. ok is
// false when no bridge has ever sent actor.list, so a caller cannot yet
// validate an actorId against it.
func (h *Hub) KnownActors() ([]protocol.ActorSummary, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if !h.haveActors {
		return nil, false
	}
	out := make([]protocol.ActorSummary, len(h.knownActors))
	copy(out, h.knownActors)
	return out, true
}

func (h *Hub) newConnID(prefix string) string {
	n := h.connSeq.Add(1)
	return prefix + "-" + itoa(n)
}

func (h *Hub) newCmdID() string {
	n := h.cmdSeq.Add(1)
	return "cmd-" + itoa(n)
}

func itoa(n uint64) string {
	// A tiny uint64-to-string helper keeps this file free of strconv
	// import noise for what is otherwise a one-line need.
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}

func errorEnvelope(id, code, message string) protocol.Envelope {
	payload, _ := json.Marshal(protocol.ErrorPayload{Code: code, Message: message})
	return protocol.Raw(protocol.TypeError, id, "", payload)
}
