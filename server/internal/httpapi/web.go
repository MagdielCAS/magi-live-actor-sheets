package httpapi

import (
	"net/http"
	"path"
	"strings"
)

// assetsDir is the one directory that holds the built script and style
// files. The build gives each of those files a name that contains a hash
// of its content, so the name can never mean a different file.
const assetsDir = "assets"

// serveWeb serves the mobile web page. It serves index.html for "/" and
// for any path that does not match a real file, so a deep link into the
// page (for example "/?c=123456") still loads the app.
func (s *Server) serveWeb(w http.ResponseWriter, r *http.Request) {
	setSecurityHeaders(w)

	rel := strings.TrimPrefix(path.Clean(r.URL.Path), "/")

	// A request for a build asset must never fall back to index.html.
	//
	// The fallback answers with HTML and status 200, and the nosniff
	// header then makes the browser refuse the script. The page is blank,
	// no JavaScript runs, and nothing says why. This happens whenever a
	// browser keeps an old index.html and asks for a file that a new
	// release removed. A 404 is the honest answer, and it is also the one
	// a person can see in the network panel.
	if isAssetPath(rel) && !s.fileExists(rel) {
		http.NotFound(w, r)
		return
	}

	if rel == "" || rel == "." || !s.fileExists(rel) {
		setNoCache(w)
		http.ServeFileFS(w, r, s.web, "index.html")
		return
	}

	setCacheHeaders(w, rel)
	http.ServeFileFS(w, r, s.web, rel)
}

// isAssetPath reports whether the path names a file in the assets
// directory of the build.
func isAssetPath(rel string) bool {
	return rel == assetsDir || strings.HasPrefix(rel, assetsDir+"/")
}

func (s *Server) fileExists(rel string) bool {
	f, err := s.web.Open(rel)
	if err != nil {
		return false
	}
	_ = f.Close()
	return true
}

// setCacheHeaders tells a browser how long it may keep a file.
//
// A file in the assets directory carries a hash of its content in its
// name, so it is safe to keep for a year. "immutable" is the part that
// stops a browser from asking again on each reload, which costs several
// round trips on a mobile network.
//
// Every other file, index.html above all, must be checked each time. The
// page names the current asset files, so an old copy of it asks for files
// that no longer exist.
func setCacheHeaders(w http.ResponseWriter, rel string) {
	if isAssetPath(rel) {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		return
	}
	setNoCache(w)
}

// setNoCache asks for a check on each request. It is not "no-store": a
// browser may still keep the file and get status 304, which costs one
// small request instead of the whole file.
func setNoCache(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-cache")
}

// setSecurityHeaders adds headers appropriate for a same-origin app.
func setSecurityHeaders(w http.ResponseWriter) {
	h := w.Header()
	h.Set("X-Content-Type-Options", "nosniff")
	// Scripts and connections stay on this origin. There are three
	// exceptions, and each one is a thing that cannot run code:
	//
	//   img-src    a portrait and an item icon come from the Foundry
	//              server, which is a different origin, and the page icon
	//              is a data URL.
	//   style-src  the design system asks Google Fonts for its four faces.
	//   font-src   Google Fonts serves the font files from a second host.
	//
	// The icons are NOT an exception: they are served from this origin, so
	// the page draws them with no route to the internet, and no third
	// party can run code in a page that holds a session token.
	//
	// There is no 'unsafe-inline' and no 'unsafe-eval'. The build keeps
	// every script and every style in its own file, and the page compiles
	// its templates at build time, so it needs neither. A browser test in
	// app/scripts/smoke.mjs runs the page against this policy, because a
	// development server sends no policy at all and would hide a fault.
	h.Set("Content-Security-Policy",
		"default-src 'self'; "+
			"img-src 'self' data: http: https:; "+
			"style-src 'self' https://fonts.googleapis.com; "+
			"font-src 'self' https://fonts.gstatic.com; "+
			"object-src 'none'; "+
			"base-uri 'self'; "+
			"form-action 'self'; "+
			"frame-ancestors 'none'")
	h.Set("Referrer-Policy", "no-referrer")
}
