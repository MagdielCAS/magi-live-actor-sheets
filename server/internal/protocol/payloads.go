package protocol

import "time"

// BridgeHello is the payload of the bridge's first message. The server
// checks Secret before it accepts the connection.
type BridgeHello struct {
	Secret         string `json:"secret"`
	WorldID        string `json:"worldId"`
	WorldTitle     string `json:"worldTitle"`
	SystemID       string `json:"systemId"`
	SystemVersion  string `json:"systemVersion"`
	FoundryVersion string `json:"foundryVersion"`
	ModuleVersion  string `json:"moduleVersion"`
}

// ActorSummary names one actor the bridge can serve.
type ActorSummary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Img  string `json:"img"`
}

// ActorList is the payload of actor.list.
type ActorList struct {
	Actors []ActorSummary `json:"actors"`
}

// CommandPatch is the payload of command.patch and actor.patch. Changes
// holds Foundry document paths; see internal/authz for the paths a caller
// may set.
type CommandPatch struct {
	Target  string         `json:"target"`
	ItemID  string         `json:"itemId,omitempty"`
	Changes map[string]any `json:"changes"`
}

// CommandRoll is the payload of command.roll and actor.roll.
type CommandRoll struct {
	Kind      string `json:"kind"`
	Key       string `json:"key,omitempty"`
	ItemID    string `json:"itemId,omitempty"`
	Advantage string `json:"advantage,omitempty"`
}

// CommandUse is the payload of command.use and actor.use.
type CommandUse struct {
	ItemID string `json:"itemId"`
	Level  *int   `json:"level,omitempty"`
}

// CommandChat is the payload of command.chat and actor.chat.
type CommandChat struct {
	Text  string `json:"text"`
	Emote bool   `json:"emote,omitempty"`
}

// CommandResult is the payload of command.result. The bridge sends this in
// reply to every command.* message.
type CommandResult struct {
	Ok     bool   `json:"ok"`
	Error  string `json:"error,omitempty"`
	Detail string `json:"detail,omitempty"`
}

// PairingRequest is the payload of pairing.request.
type PairingRequest struct {
	ActorID string `json:"actorId"`
}

// PairingIssued is the payload of pairing.issued.
type PairingIssued struct {
	Code      string    `json:"code"`
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// BridgeReady is the payload of bridge.ready, the answer to bridge.hello.
type BridgeReady struct {
	Subscriptions []string `json:"subscriptions"`
}

// Subscriptions is the payload of subscriptions.set.
type Subscriptions struct {
	ActorIDs []string `json:"actorIds"`
}

// BridgeState is the payload of bridge.state.
type BridgeState struct {
	Online bool `json:"online"`
}

// ErrorPayload is the payload of the error message.
type ErrorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Ack is the payload of the ack message. It carries no data; the envelope
// id names the request it answers.
type Ack struct{}
