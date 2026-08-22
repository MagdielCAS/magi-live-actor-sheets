// Package config reads the server's runtime settings from flags and
// environment variables. A flag wins over its matching environment
// variable, which wins over the built-in default.
package config

import (
	"crypto/rand"
	"encoding/hex"
	"flag"
	"fmt"
	"net/url"
	"os"
	"strings"
)

const defaultBind = "127.0.0.1:30001"

// Config holds one resolved set of server settings.
type Config struct {
	// Bind is the address the HTTP server listens on.
	Bind string
	// BridgeSecret is the shared secret the bridge must send in
	// bridge.hello. It is never empty; see GeneratedSecret.
	BridgeSecret string
	// TrustLAN turns on the LAN admission path for /ws/client.
	TrustLAN bool
	// TrustedProxies is a raw comma list of IPs or CIDRs allowed to set
	// X-Forwarded-For. The httpapi package parses it.
	TrustedProxies string
	// PublicURL is the address where a player reaches the page, for
	// example "https://foundry.example.com/magi". Set it when a proxy
	// serves the relay under a path, because the proxy removes that path
	// before the request arrives and the server cannot find it again.
	// Empty means the server reads the scheme and host of the request.
	PublicURL string

	// GeneratedSecret is true when MAGI_BRIDGE_SECRET was empty and the
	// server made up BridgeSecret for this run. The caller must print
	// BridgeSecret so an operator can configure the bridge with it;
	// otherwise every bridge connection fails.
	GeneratedSecret bool
}

// Load registers the server's flags on fs and resolves settings from fs,
// args, and the environment. Register any extra flags on fs before calling
// Load, since Load parses fs exactly once.
func Load(fs *flag.FlagSet, args []string) (*Config, error) {
	env := func(key, fallback string) string {
		if v, ok := os.LookupEnv(key); ok {
			return v
		}
		return fallback
	}

	bind := fs.String("bind", env("MAGI_BIND", defaultBind), "address to listen on")
	secret := fs.String("bridge-secret", env("MAGI_BRIDGE_SECRET", ""), "shared secret the bridge must send in bridge.hello")
	trustLAN := fs.Bool("trust-lan", parseBool(env("MAGI_TRUST_LAN", "true")), "allow LAN clients to connect with only an actorId")
	trustedProxies := fs.String("trusted-proxies", env("MAGI_TRUSTED_PROXIES", ""), "comma list of proxy IPs or CIDRs allowed to set X-Forwarded-For")
	publicURL := fs.String("public-url", env("MAGI_PUBLIC_URL", ""), "address where a player reaches the page, for example https://host/magi")

	if err := fs.Parse(args); err != nil {
		return nil, err
	}

	cfg := &Config{
		Bind:           *bind,
		BridgeSecret:   *secret,
		TrustLAN:       *trustLAN,
		TrustedProxies: *trustedProxies,
		PublicURL:      strings.TrimRight(*publicURL, "/"),
	}

	if cfg.PublicURL != "" {
		u, err := url.Parse(cfg.PublicURL)
		if err != nil || u.Scheme == "" || u.Host == "" {
			return nil, fmt.Errorf("config: MAGI_PUBLIC_URL must be an absolute address, for example https://host/magi")
		}
	}

	if cfg.BridgeSecret == "" {
		generated, err := randomSecret()
		if err != nil {
			return nil, fmt.Errorf("config: make a bridge secret: %w", err)
		}
		cfg.BridgeSecret = generated
		cfg.GeneratedSecret = true
	}

	return cfg, nil
}

// parseBool reads a loose boolean the way an operator would type it.
// Anything not recognized as false counts as true, so the default stays on.
func parseBool(v string) bool {
	switch v {
	case "0", "false", "False", "FALSE", "no", "No", "NO", "off", "Off", "OFF":
		return false
	default:
		return true
	}
}

// randomSecret makes a 32-byte secret encoded as hex text.
func randomSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
