package authz

import "testing"

func TestCheckPatch(t *testing.T) {
	cases := []struct {
		name    string
		target  string
		changes map[string]any
		wantErr bool
	}{
		{
			name:    "allowed actor hp path",
			target:  "actor",
			changes: map[string]any{"system.attributes.hp.value": 12},
		},
		{
			name:    "allowed actor currency path",
			target:  "actor",
			changes: map[string]any{"system.currency.gp": 25},
		},
		{
			name:    "allowed spell slot path",
			target:  "actor",
			changes: map[string]any{"system.spells.spell5.value": 1},
		},
		{
			name:    "allowed item path",
			target:  "item",
			changes: map[string]any{"system.quantity": 3},
		},
		{
			name:    "multiple allowed paths together",
			target:  "actor",
			changes: map[string]any{"system.attributes.hp.value": 1, "system.currency.gp": 1},
		},
		{
			name:    "ownership is rejected",
			target:  "actor",
			changes: map[string]any{"ownership": map[string]any{}},
			wantErr: true,
		},
		{
			name:    "flags path is rejected",
			target:  "actor",
			changes: map[string]any{"flags.x": true},
			wantErr: true,
		},
		{
			name:    "ac value is rejected",
			target:  "actor",
			changes: map[string]any{"system.attributes.ac.value": 20},
			wantErr: true,
		},
		{
			name:    "name is rejected",
			target:  "actor",
			changes: map[string]any{"name": "New Name"},
			wantErr: true,
		},
		{
			name:    "spell slot out of range is rejected",
			target:  "actor",
			changes: map[string]any{"system.spells.spell10.value": 1},
			wantErr: true,
		},
		{
			name:    "prefix trick is rejected",
			target:  "actor",
			changes: map[string]any{"system.attributes.hp.value.extra": 1},
			wantErr: true,
		},
		{
			name:    "dot-dot trick is rejected",
			target:  "actor",
			changes: map[string]any{"system.attributes.hp.value.." + "/ownership": 1},
			wantErr: true,
		},
		{
			name:    "one bad key rejects the whole patch",
			target:  "actor",
			changes: map[string]any{"system.attributes.hp.value": 1, "ownership": map[string]any{}},
			wantErr: true,
		},
		{
			name:    "unknown target is rejected",
			target:  "actorx",
			changes: map[string]any{"system.attributes.hp.value": 1},
			wantErr: true,
		},
		{
			name:    "empty changes is rejected",
			target:  "actor",
			changes: map[string]any{},
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := CheckPatch(tc.target, tc.changes)
			if tc.wantErr && err == nil {
				t.Fatalf("CheckPatch(%q, %v) = nil, want error", tc.target, tc.changes)
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("CheckPatch(%q, %v) = %v, want nil", tc.target, tc.changes, err)
			}
		})
	}
}
