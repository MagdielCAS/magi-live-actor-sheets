// Command magi-server runs the Magi Live Actor Sheets relay: the Go
// process that sits between the Foundry module and the mobile web page.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/config"
	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/httpapi"
	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/hub"
	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/pairing"
)

// shutdownTimeout bounds how long graceful shutdown waits for connections
// to close.
const shutdownTimeout = 10 * time.Second

func main() {
	log := slog.New(slog.NewTextHandler(os.Stderr, nil))
	if err := run(log); err != nil {
		log.Error("magi-server exited with an error", "error", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	// The web page assets live at the repo root, in /web, outside this Go
	// module (server/). Embedding them would need a copy step at build
	// time to bring them inside the module, which this project does not
	// yet have. Reading them from disk with -web is simpler and correct
	// for now; a later change can add an embedded build once the asset
	// layout under /web is settled.
	fs := flag.NewFlagSet("magi-server", flag.ContinueOnError)
	webDir := fs.String("web", defaultWebDir(), "directory that holds the web page assets")

	cfg, err := config.Load(fs, os.Args[1:])
	if err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}

	if cfg.GeneratedSecret {
		fmt.Fprintf(os.Stderr, "\nMAGI_BRIDGE_SECRET was not set. Generated one for this run:\n\n    %s\n\nPut this value in the Foundry module settings, or every bridge connection will fail.\n\n", cfg.BridgeSecret)
	}

	store := pairing.NewStore(time.Now)
	h := hub.New(log, store)

	server, err := httpapi.NewServer(cfg, h, store, os.DirFS(*webDir), log)
	if err != nil {
		return fmt.Errorf("build the HTTP server: %w", err)
	}

	httpServer := &http.Server{
		Addr:              cfg.Bind,
		Handler:           server,
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serveErr := make(chan error, 1)
	go func() {
		log.Info("listening", "addr", cfg.Bind, "webDir", *webDir, "trustLAN", cfg.TrustLAN)
		err := httpServer.ListenAndServe()
		if errors.Is(err, http.ErrServerClosed) {
			err = nil
		}
		serveErr <- err
	}()

	select {
	case <-ctx.Done():
		log.Info("shutting down")
	case err := <-serveErr:
		return err
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown: %w", err)
	}
	return <-serveErr
}

// defaultWebDir points at ../web relative to the running binary, which is
// where /web sits next to /server in this repo's layout. os.Executable
// failing is rare; ./web is a reasonable fallback for that case.
func defaultWebDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "./web"
	}
	return filepath.Join(filepath.Dir(exe), "..", "web")
}
