// Package httpapi is the HTTP and WebSocket transport for the relay. It
// owns connection accept, origin and admission checks, and the read loop
// for each connection. It hands every message to internal/hub, which owns
// the routing logic.
package httpapi

import (
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"

	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/config"
	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/hub"
	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/pairing"
)

// Server is the relay's HTTP handler. It implements http.Handler.
type Server struct {
	cfg       *config.Config
	hub       *hub.Hub
	pairing   *pairing.Store
	web       fs.FS
	log       *slog.Logger
	admission admissionConfig

	mux *http.ServeMux
}

// NewServer builds the relay's HTTP handler. web serves the mobile page
// and its assets; it is read-only from the server's point of view.
func NewServer(cfg *config.Config, h *hub.Hub, store *pairing.Store, web fs.FS, log *slog.Logger) (*Server, error) {
	proxies, err := parseTrustedProxies(cfg.TrustedProxies)
	if err != nil {
		return nil, fmt.Errorf("httpapi: %w", err)
	}

	s := &Server{
		cfg:     cfg,
		hub:     h,
		pairing: store,
		web:     web,
		log:     log,
		admission: admissionConfig{
			trustLAN:       cfg.TrustLAN,
			trustedProxies: proxies,
		},
	}
	s.routes()
	return s, nil
}

func (s *Server) routes() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.handleHealthz)
	mux.HandleFunc("/ws/bridge", s.handleWSBridge)
	mux.HandleFunc("/ws/client", s.handleWSClient)
	mux.HandleFunc("POST /api/pair", s.handlePair)
	mux.HandleFunc("/", s.serveWeb)
	s.mux = mux
}

// ServeHTTP implements http.Handler.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("OK"))
}
