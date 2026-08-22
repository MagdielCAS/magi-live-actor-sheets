package hub

import (
	"context"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/MagdielCAS/magi-live-actor-sheets/server/internal/protocol"
)

// outboundBufferSize bounds how many messages a connection may queue
// before the hub treats it as too slow to keep up.
const outboundBufferSize = 32

// writeTimeout bounds a single write to a connection.
const writeTimeout = 5 * time.Second

// pingInterval controls how often the server pings an idle connection. A
// reverse proxy usually closes a WebSocket that sends nothing for 60
// seconds. The ping keeps the connection open, and it also shows quickly
// that a phone went to sleep or left the network.
const pingInterval = 25 * time.Second

// outConn wraps one WebSocket connection with a bounded outbound queue and
// a single writer goroutine. This is the only path that writes to the
// connection, so no code ever writes to a WebSocket from two goroutines.
type outConn struct {
	id   string
	conn *websocket.Conn

	send chan protocol.Envelope

	closeOnce sync.Once
	closed    chan struct{}
}

func newOutConn(id string, conn *websocket.Conn) *outConn {
	c := &outConn{
		id:     id,
		conn:   conn,
		send:   make(chan protocol.Envelope, outboundBufferSize),
		closed: make(chan struct{}),
	}
	go c.writeLoop()
	return c
}

// enqueue queues env for delivery. It never blocks the caller: if the
// queue is full, the connection is too slow, so enqueue closes it instead
// of waiting.
func (c *outConn) enqueue(env protocol.Envelope) {
	select {
	case c.send <- env:
	case <-c.closed:
	default:
		c.closeWith(websocket.StatusPolicyViolation, "connection is too slow")
	}
}

func (c *outConn) writeLoop() {
	ping := time.NewTicker(pingInterval)
	defer ping.Stop()

	for {
		select {
		case env := <-c.send:
			ctx, cancel := context.WithTimeout(context.Background(), writeTimeout)
			err := wsjson.Write(ctx, c.conn, env)
			cancel()
			if err != nil {
				c.closeWith(websocket.StatusInternalError, "write failed")
				return
			}
		case <-ping.C:
			ctx, cancel := context.WithTimeout(context.Background(), writeTimeout)
			err := c.conn.Ping(ctx)
			cancel()
			if err != nil {
				c.closeWith(websocket.StatusGoingAway, "the connection does not answer")
				return
			}
		case <-c.closed:
			return
		}
	}
}

// closeWith closes the connection once. The actual close handshake runs in
// its own goroutine so a slow network never blocks the caller, which may
// be holding the hub's lock.
func (c *outConn) closeWith(code websocket.StatusCode, reason string) {
	c.closeOnce.Do(func() {
		close(c.closed)
		go c.conn.Close(code, reason)
	})
}
