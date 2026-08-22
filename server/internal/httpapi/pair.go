package httpapi

import (
	"encoding/json"
	"net/http"
	"time"
)

// maxPairBodyBytes bounds the size of a POST /api/pair request body.
const maxPairBodyBytes = 4096

type pairRequest struct {
	Code string `json:"code"`
}

type pairResponse struct {
	Token     string    `json:"token"`
	ActorID   string    `json:"actorId"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type pairErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// handlePair answers POST /api/pair. It sends no CORS headers, so only a
// same-origin page can call it from a browser.
func (s *Server) handlePair(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxPairBodyBytes)

	var req pairRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writePairError(w, http.StatusBadRequest, "bad_request", "the request body is not valid JSON")
		return
	}
	if req.Code == "" {
		writePairError(w, http.StatusBadRequest, "bad_request", "the code field is required")
		return
	}

	token, actorID, expiresAt, err := s.pairing.Redeem(req.Code)
	if err != nil {
		writePairError(w, http.StatusUnauthorized, "invalid_code", "the pairing code is wrong or expired")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(pairResponse{Token: token, ActorID: actorID, ExpiresAt: expiresAt})
}

func writePairError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(pairErrorResponse{Error: code, Message: message})
}
