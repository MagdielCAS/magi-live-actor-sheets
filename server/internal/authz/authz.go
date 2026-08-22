// Package authz holds the write allowlist from docs/protocol.md section 8.
// The module also enforces this list on its side; the server enforces it
// again so a compromised or buggy client cannot write outside it.
package authz

import "fmt"

// actorPaths lists the Foundry document paths a patch may set on an actor.
var actorPaths = buildActorPaths()

// Two paths look writable but are not, so they are absent on purpose. The
// dnd5e system calculates system.attributes.exhaustion from the exhaustion
// condition, and it calculates system.uses.value as max minus spent. A
// write to either one has no effect, so a client must send
// system.uses.spent instead. See docs/protocol.md section 8.

// itemPaths lists the Foundry document paths a patch may set on an item.
var itemPaths = map[string]struct{}{
	"system.quantity":             {},
	"system.equipped":             {},
	"system.preparation.prepared": {},
	"system.uses.spent":           {},
}

func buildActorPaths() map[string]struct{} {
	paths := map[string]struct{}{
		"system.attributes.hp.value":       {},
		"system.attributes.hp.max":         {},
		"system.attributes.hp.temp":        {},
		"system.attributes.hp.tempmax":     {},
		"system.attributes.death.success":  {},
		"system.attributes.death.failure":  {},
		"system.attributes.inspiration":    {},
		"system.spells.pact.value":         {},
		"system.currency.pp":               {},
		"system.currency.gp":               {},
		"system.currency.ep":               {},
		"system.currency.sp":               {},
		"system.currency.cp":               {},
		"system.resources.primary.value":   {},
		"system.resources.secondary.value": {},
		"system.resources.tertiary.value":  {},
		"system.details.biography.value":   {},
		"system.details.trait":             {},
		"system.details.ideal":             {},
		"system.details.bond":              {},
		"system.details.flaw":              {},
	}
	for level := 1; level <= 9; level++ {
		paths[fmt.Sprintf("system.spells.spell%d.value", level)] = struct{}{}
	}
	return paths
}

// CheckPatch reports whether every key of changes is on the allowlist for
// target. It rejects the whole patch, naming the first offending path, if
// one key is not allowed. It also rejects an unknown target and a patch
// with no changes.
func CheckPatch(target string, changes map[string]any) error {
	var allowed map[string]struct{}
	switch target {
	case "actor":
		allowed = actorPaths
	case "item":
		allowed = itemPaths
	default:
		return fmt.Errorf("authz: unknown patch target %q", target)
	}

	if len(changes) == 0 {
		return fmt.Errorf("authz: the patch has no changes")
	}

	for path := range changes {
		if _, ok := allowed[path]; !ok {
			return fmt.Errorf("authz: path %q is not allowed on target %q", path, target)
		}
	}
	return nil
}
