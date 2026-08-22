// Package protocol implements the wire format that docs/protocol.md
// defines. It holds the envelope, the message type names, and the payload
// shapes. It does not hold any transport or business logic.
package protocol

import "encoding/json"

// Version is the only envelope version the server accepts.
const Version = 1

// Envelope is the shape of every message the protocol sends in both
// directions. See docs/protocol.md section 2.
type Envelope struct {
	V       int             `json:"v"`
	Type    string          `json:"type"`
	ID      string          `json:"id,omitempty"`
	ActorID string          `json:"actorId,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// New builds an envelope with the current protocol version and the given
// payload. A nil payload marshals to an empty envelope field.
func New(msgType, id, actorID string, payload any) (Envelope, error) {
	env := Envelope{V: Version, Type: msgType, ID: id, ActorID: actorID}
	if payload == nil {
		return env, nil
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return Envelope{}, err
	}
	env.Payload = raw
	return env, nil
}

// Raw builds an envelope whose payload is already encoded JSON. Use this to
// forward a payload the server does not need to parse.
func Raw(msgType, id, actorID string, payload json.RawMessage) Envelope {
	return Envelope{V: Version, Type: msgType, ID: id, ActorID: actorID, Payload: payload}
}

// Decode unmarshals the envelope payload into v.
func (e Envelope) Decode(v any) error {
	return json.Unmarshal(e.Payload, v)
}
