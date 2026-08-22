package httpapi

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
)

// sameOrigin reports whether the WebSocket Origin header names the same
// host as the request itself. A missing Origin header returns false; the
// caller decides whether that is acceptable (see docs/protocol.md
// section 7, "Same origin").
func sameOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return false
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	return strings.EqualFold(u.Host, r.Host)
}

// admissionConfig holds the settings isLANPeer needs.
type admissionConfig struct {
	trustLAN       bool
	trustedProxies []*net.IPNet
}

// parseTrustedProxies turns a comma list of IPs or bare CIDRs into a list
// of networks. A bare IP becomes a single-address network.
func parseTrustedProxies(list string) ([]*net.IPNet, error) {
	var nets []*net.IPNet
	for _, tok := range strings.Split(list, ",") {
		tok = strings.TrimSpace(tok)
		if tok == "" {
			continue
		}
		if !strings.Contains(tok, "/") {
			ip := net.ParseIP(tok)
			if ip == nil {
				return nil, fmt.Errorf("httpapi: bad trusted proxy address %q", tok)
			}
			bits := 32
			if ip.To4() == nil {
				bits = 128
			}
			tok = fmt.Sprintf("%s/%d", ip.String(), bits)
		}
		_, n, err := net.ParseCIDR(tok)
		if err != nil {
			return nil, fmt.Errorf("httpapi: bad trusted proxy network %q: %w", tok, err)
		}
		nets = append(nets, n)
	}
	return nets, nil
}

func isTrustedProxy(ip net.IP, nets []*net.IPNet) bool {
	for _, n := range nets {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

// isLANPeer reports whether the request comes from a peer on the LAN:
// loopback, an RFC 1918 address, a unique-local IPv6 address, or a
// link-local address. It reads X-Forwarded-For only when the direct peer
// is in cfg.trustedProxies, and then uses the last hop in that header that
// is not itself a trusted proxy.
func isLANPeer(r *http.Request, cfg admissionConfig) bool {
	if !cfg.trustLAN {
		return false
	}

	peer := remoteIP(r.RemoteAddr)
	if peer == nil {
		return false
	}

	if isTrustedProxy(peer, cfg.trustedProxies) {
		if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
			if real := lastUntrustedHop(fwd, cfg.trustedProxies); real != nil {
				peer = real
			}
		}
	}

	return isPrivateOrLocal(peer)
}

func remoteIP(remoteAddr string) net.IP {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	return net.ParseIP(host)
}

// lastUntrustedHop scans an X-Forwarded-For header from the end (the hop
// closest to this server) and returns the first address that is not a
// trusted proxy. That address is the peer the trusted proxy chain reports
// as the real client.
func lastUntrustedHop(header string, trustedProxies []*net.IPNet) net.IP {
	hops := strings.Split(header, ",")
	for i := len(hops) - 1; i >= 0; i-- {
		ip := net.ParseIP(strings.TrimSpace(hops[i]))
		if ip == nil {
			continue
		}
		if !isTrustedProxy(ip, trustedProxies) {
			return ip
		}
	}
	return nil
}

func isPrivateOrLocal(ip net.IP) bool {
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast()
}
