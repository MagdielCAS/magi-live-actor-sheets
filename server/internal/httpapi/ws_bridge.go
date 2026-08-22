package httpapi

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/protocol"
)

// helloTimeout bounds how long the server waits for bridge.hello after
// accepting a /ws/bridge connection.
const helloTimeout = 10 * time.Second

// bridgeReadLimit bounds one message from the bridge. A snapshot must fit
// in it.
const bridgeReadLimit = 4 << 20 // 4 MiB

// clientReadLimit bounds one message from a mobile page. A page sends only
// commands, but a biography edit can still be long.
const clientReadLimit = 256 << 10 // 256 KiB

// handleWSBridge accepts the one bridge connection for the world. The
// first message must be bridge.hello with the right secret; anything else
// closes the connection.
func (s *Server) handleWSBridge(w http.ResponseWriter, r *http.Request) {
	// A missing Origin header is expected here: the dev bridge (running
	// inside Foundry, not a browser tab reachable from the internet) may
	// not send one. A present Origin header still has to match, in case a
	// browser-based bridge is ever added.
	if origin := r.Header.Get("Origin"); origin != "" && !sameOrigin(r) {
		http.Error(w, "origin not allowed", http.StatusForbidden)
		return
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})
	if err != nil {
		s.log.Warn("bridge handshake failed", "error", err)
		return
	}
	defer conn.CloseNow()

	// A snapshot of a full character is much larger than the library
	// default of 32 KiB, because it carries the biography, the inventory,
	// and the spell list.
	conn.SetReadLimit(bridgeReadLimit)

	hello, ok := s.readBridgeHello(r.Context(), conn)
	if !ok {
		return
	}

	baseURL := s.publicBaseURL(r)
	connID := s.hub.RegisterBridge(conn, hello, baseURL)
	defer s.hub.UnregisterBridge(connID)

	for {
		var env protocol.Envelope
		if err := wsjson.Read(r.Context(), conn, &env); err != nil {
			return
		}
		s.hub.HandleBridgeMessage(connID, env)
	}
}

// readBridgeHello reads and checks the first message on a new bridge
// connection. It closes conn itself on any failure.
func (s *Server) readBridgeHello(ctx context.Context, conn *websocket.Conn) (protocol.BridgeHello, bool) {
	readCtx, cancel := context.WithTimeout(ctx, helloTimeout)
	defer cancel()

	var env protocol.Envelope
	if err := wsjson.Read(readCtx, conn, &env); err != nil {
		conn.Close(websocket.StatusPolicyViolation, "expected bridge.hello")
		return protocol.BridgeHello{}, false
	}
	if env.V != protocol.Version || env.Type != protocol.TypeBridgeHello {
		conn.Close(websocket.StatusPolicyViolation, "the first message must be bridge.hello")
		return protocol.BridgeHello{}, false
	}

	var hello protocol.BridgeHello
	if err := json.Unmarshal(env.Payload, &hello); err != nil {
		conn.Close(websocket.StatusPolicyViolation, "bad bridge.hello payload")
		return protocol.BridgeHello{}, false
	}

	if subtle.ConstantTimeCompare([]byte(hello.Secret), []byte(s.cfg.BridgeSecret)) != 1 {
		conn.Close(websocket.StatusPolicyViolation, "wrong bridge secret")
		return protocol.BridgeHello{}, false
	}

	return hello, true
}

// publicBaseURL gives the address where a player reaches the page. A
// configured public URL always wins, because a proxy that serves the relay
// under a path removes that path before the request arrives, and the
// server cannot find it again from the request alone.
func (s *Server) publicBaseURL(r *http.Request) string {
	if s.cfg.PublicURL != "" {
		return s.cfg.PublicURL
	}
	return requestBaseURL(r)
}

// requestBaseURL guesses the scheme and host the caller used to reach this
// server, for building URLs to hand back to the caller (for example the
// pairing URL). It is not a security check.
func requestBaseURL(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	return scheme + "://" + r.Host
}
