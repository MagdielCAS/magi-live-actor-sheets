package protocol

import (
	"encoding/json"
	"fmt"
)

// Snapshot is one cached actor.snapshot. The server never reads the
// character data in Raw; it only needs ActorID and Rev to decide whether a
// new snapshot replaces the cached one.
type Snapshot struct {
	ActorID string
	Rev     int64
	Raw     json.RawMessage
}

// snapshotMeta is the only part of a SheetDTO the server needs to read.
type snapshotMeta struct {
	ID  string `json:"id"`
	Rev int64  `json:"rev"`
}

// ParseSnapshotMeta reads id and rev out of a raw SheetDTO payload. It
// leaves the rest of the document opaque, so the server never needs to
// understand game system data.
func ParseSnapshotMeta(raw json.RawMessage) (id string, rev int64, err error) {
	var meta snapshotMeta
	if err := json.Unmarshal(raw, &meta); err != nil {
		return "", 0, fmt.Errorf("read snapshot id and rev: %w", err)
	}
	return meta.ID, meta.Rev, nil
}
