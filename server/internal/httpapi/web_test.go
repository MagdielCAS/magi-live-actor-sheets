package httpapi

import "testing"

// A request for a build asset must never fall back to index.html. The
// fallback answers HTML with status 200, and the nosniff header then makes
// the browser refuse the script, which leaves a blank page and no reason.
func TestIsAssetPath(t *testing.T) {
	cases := []struct {
		rel  string
		want bool
	}{
		{"assets", true},
		{"assets/index-abc123.js", true},
		{"assets/index-abc123.css", true},
		{"", false},
		{"index.html", false},
		{"favicon.ico", false},
		// A directory whose name only starts with "assets" is not the
		// assets directory.
		{"assetsomething/app.js", false},
	}

	for _, c := range cases {
		if got := isAssetPath(c.rel); got != c.want {
			t.Errorf("isAssetPath(%q) = %v, want %v", c.rel, got, c.want)
		}
	}
}
