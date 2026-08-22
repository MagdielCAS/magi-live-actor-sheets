package httpapi

import (
	"net/http"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/protocol"
)

// handleWSClient accepts one mobile page connection. Admission follows
// docs/protocol.md section 7: a paired device sends ?token=, a device on
// the LAN sends ?actorId=.
func (s *Server) handleWSClient(w http.ResponseWriter, r *http.Request) {
	// The client is always a browser page, so it always sends an Origin
	// header, and that header must match this server.
	if !sameOrigin(r) {
		// Say so in the log. A browser turns this into close code 1006
		// with no reason, so the log is the only place to see why.
		s.log.Warn("client refused: the origin does not match this server",
			"origin", r.Header.Get("Origin"), "host", r.Host)
		http.Error(w, "origin not allowed", http.StatusForbidden)
		return
	}

	actorID, ok := s.admitClient(r)
	if !ok {
		s.log.Warn("client refused: no valid token, and the peer is not on the local network",
			"remote", r.RemoteAddr)
		http.Error(w, "not authorized", http.StatusUnauthorized)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		s.log.Warn("client handshake failed", "error", err)
		return
	}
	defer conn.CloseNow()
	conn.SetReadLimit(clientReadLimit)

	connID := s.hub.RegisterClient(conn, actorID)
	defer s.hub.UnregisterClient(connID)

	for {
		var env protocol.Envelope
		if err := wsjson.Read(r.Context(), conn, &env); err != nil {
			return
		}
		s.hub.HandleClientMessage(connID, env)
	}
}

// admitClient decides whether a /ws/client request may connect, and which
// actor it connects as.
func (s *Server) admitClient(r *http.Request) (actorID string, ok bool) {
	if token := r.URL.Query().Get("token"); token != "" {
		return s.pairing.Lookup(token)
	}

	actorID = r.URL.Query().Get("actorId")
	if actorID == "" {
		return "", false
	}
	if !isLANPeer(r, s.admission) {
		return "", false
	}
	if known, haveList := s.hub.KnownActors(); haveList && !containsActor(known, actorID) {
		return "", false
	}
	return actorID, true
}

func containsActor(actors []protocol.ActorSummary, id string) bool {
	for _, a := range actors {
		if a.ID == id {
			return true
		}
	}
	return false
}
