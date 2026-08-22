package protocol

// Message types the bridge sends to the server (docs/protocol.md 3.1).
const (
	TypeBridgeHello    = "bridge.hello"
	TypeActorList      = "actor.list"
	TypeActorSnapshot  = "actor.snapshot"
	TypeCommandResult  = "command.result"
	TypePairingRequest = "pairing.request"
)

// Message types the server sends to the bridge (docs/protocol.md 3.2).
const (
	TypeBridgeReady      = "bridge.ready"
	TypeSubscriptionsSet = "subscriptions.set"
	TypeActorRequest     = "actor.request"
	TypeCommandPatch     = "command.patch"
	TypeCommandRoll      = "command.roll"
	TypeCommandUse       = "command.use"
	TypeCommandChat      = "command.chat"
	TypePairingIssued    = "pairing.issued"
)

// Message types the server sends to a client (docs/protocol.md 4.1).
// TypeActorSnapshot and TypeBridgeState are shared with the bridge-facing
// direction above.
const (
	TypeBridgeState = "bridge.state"
	TypeAck         = "ack"
	TypeError       = "error"
)

// Message types a client sends to the server (docs/protocol.md 4.2). The
// server rewrites each of these into the matching command.* type before it
// forwards the message to the bridge.
const (
	TypeActorPatch = "actor.patch"
	TypeActorRoll  = "actor.roll"
	TypeActorUse   = "actor.use"
	TypeActorChat  = "actor.chat"
)
