package httpapi

import (
	"net/http"
	"path"
	"strings"
)

// serveWeb serves the mobile web page. It serves index.html for "/" and
// for any path that does not match a real file, so a deep link into the
// page (for example "/?code=123456") still loads the app.
func (s *Server) serveWeb(w http.ResponseWriter, r *http.Request) {
	setSecurityHeaders(w)

	rel := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
	if rel == "" || rel == "." || !s.fileExists(rel) {
		http.ServeFileFS(w, r, s.web, "index.html")
		return
	}
	http.ServeFileFS(w, r, s.web, rel)
}

func (s *Server) fileExists(rel string) bool {
	f, err := s.web.Open(rel)
	if err != nil {
		return false
	}
	_ = f.Close()
	return true
}

// setSecurityHeaders adds headers appropriate for a same-origin app that
// loads no external resources.
func setSecurityHeaders(w http.ResponseWriter) {
	h := w.Header()
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; frame-ancestors 'none'")
	h.Set("Referrer-Policy", "no-referrer")
}
