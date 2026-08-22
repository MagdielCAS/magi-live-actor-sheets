package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSameOrigin(t *testing.T) {
	cases := []struct {
		name   string
		host   string
		origin string
		want   bool
	}{
		{name: "matching host and port", host: "example.com:30001", origin: "http://example.com:30001", want: true},
		{name: "matching host, case differs", host: "Example.com:30001", origin: "http://example.com:30001", want: true},
		{name: "different host", host: "example.com:30001", origin: "http://evil.example:30001", want: false},
		{name: "different port", host: "example.com:30001", origin: "http://example.com:9999", want: false},
		{name: "missing origin header", host: "example.com:30001", origin: "", want: false},
		{name: "unparsable origin", host: "example.com:30001", origin: "://bad", want: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/ws/client", nil)
			r.Host = tc.host
			if tc.origin != "" {
				r.Header.Set("Origin", tc.origin)
			}
			if got := sameOrigin(r); got != tc.want {
				t.Fatalf("sameOrigin() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestIsLANPeer(t *testing.T) {
	trusted, err := parseTrustedProxies("203.0.113.10")
	if err != nil {
		t.Fatalf("parseTrustedProxies() error = %v", err)
	}
	cfg := admissionConfig{trustLAN: true, trustedProxies: trusted}

	cases := []struct {
		name       string
		remoteAddr string
		xff        string
		cfg        admissionConfig
		want       bool
	}{
		{name: "loopback direct", remoteAddr: "127.0.0.1:5000", cfg: cfg, want: true},
		{name: "rfc1918 direct", remoteAddr: "192.168.1.20:5000", cfg: cfg, want: true},
		{name: "public direct", remoteAddr: "8.8.8.8:5000", cfg: cfg, want: false},
		{
			name:       "xff trusted proxy forwards a LAN client",
			remoteAddr: "203.0.113.10:443",
			xff:        "10.0.0.5",
			cfg:        cfg,
			want:       true,
		},
		{
			name:       "xff trusted proxy forwards a public client",
			remoteAddr: "203.0.113.10:443",
			xff:        "8.8.8.8",
			cfg:        cfg,
			want:       false,
		},
		{
			name:       "xff ignored when peer is not a trusted proxy",
			remoteAddr: "8.8.8.8:443",
			xff:        "10.0.0.5",
			cfg:        cfg,
			want:       false, // The direct peer (8.8.8.8) is used, not the spoofed header.
		},
		{
			name:       "trust lan disabled",
			remoteAddr: "127.0.0.1:5000",
			cfg:        admissionConfig{trustLAN: false},
			want:       false,
		},
		{
			name:       "xff skips trusted hops to find the real client",
			remoteAddr: "203.0.113.10:443",
			xff:        "10.0.0.5, 203.0.113.10",
			cfg:        cfg,
			want:       true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/ws/client", nil)
			r.RemoteAddr = tc.remoteAddr
			if tc.xff != "" {
				r.Header.Set("X-Forwarded-For", tc.xff)
			}
			if got := isLANPeer(r, tc.cfg); got != tc.want {
				t.Fatalf("isLANPeer() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestParseTrustedProxies(t *testing.T) {
	nets, err := parseTrustedProxies("10.0.0.1, 192.168.0.0/24, ")
	if err != nil {
		t.Fatalf("parseTrustedProxies() error = %v", err)
	}
	if len(nets) != 2 {
		t.Fatalf("parseTrustedProxies() returned %d networks, want 2", len(nets))
	}

	if _, err := parseTrustedProxies("not-an-ip"); err == nil {
		t.Fatal("parseTrustedProxies() with a bad address returned nil error")
	}
}
