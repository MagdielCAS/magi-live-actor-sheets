package pairing

import (
	"testing"
	"time"
)

// fakeClock lets a test move time forward deterministically.
type fakeClock struct{ now time.Time }

func (c *fakeClock) Now() time.Time { return c.now }

func newTestStore() (*Store, *fakeClock) {
	clock := &fakeClock{now: time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)}
	return NewStore(clock.Now), clock
}

func TestIssueAndRedeem(t *testing.T) {
	store, _ := newTestStore()

	code, expiresAt := store.Issue("actor-1")
	if len(code) != 6 {
		t.Fatalf("Issue code = %q, want 6 digits", code)
	}
	if !expiresAt.Equal(time.Date(2026, 1, 1, 12, 3, 0, 0, time.UTC)) {
		t.Fatalf("Issue expiresAt = %v, want 3 minutes out", expiresAt)
	}

	token, actorID, tokenExpiresAt, err := store.Redeem(code)
	if err != nil {
		t.Fatalf("Redeem() error = %v, want nil", err)
	}
	if actorID != "actor-1" {
		t.Fatalf("Redeem() actorID = %q, want actor-1", actorID)
	}
	if token == "" {
		t.Fatal("Redeem() token is empty")
	}
	wantExpiry := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC).Add(tokenTTL)
	if !tokenExpiresAt.Equal(wantExpiry) {
		t.Fatalf("Redeem() expiresAt = %v, want %v", tokenExpiresAt, wantExpiry)
	}
}

func TestRedeemTwiceFails(t *testing.T) {
	store, _ := newTestStore()
	code, _ := store.Issue("actor-1")

	if _, _, _, err := store.Redeem(code); err != nil {
		t.Fatalf("first Redeem() error = %v, want nil", err)
	}
	if _, _, _, err := store.Redeem(code); err != ErrCodeNotFound {
		t.Fatalf("second Redeem() error = %v, want ErrCodeNotFound", err)
	}
}

func TestRedeemUnknownCodeFails(t *testing.T) {
	store, _ := newTestStore()
	if _, _, _, err := store.Redeem("000000"); err != ErrCodeNotFound {
		t.Fatalf("Redeem() error = %v, want ErrCodeNotFound", err)
	}
}

func TestCodeExpiresAfterTTL(t *testing.T) {
	store, clock := newTestStore()
	code, _ := store.Issue("actor-1")

	clock.now = clock.now.Add(codeTTL + time.Second)

	if _, _, _, err := store.Redeem(code); err != ErrCodeNotFound {
		t.Fatalf("Redeem() after expiry error = %v, want ErrCodeNotFound", err)
	}
}

func TestLookupResolvesActor(t *testing.T) {
	store, _ := newTestStore()
	code, _ := store.Issue("actor-42")
	token, _, _, err := store.Redeem(code)
	if err != nil {
		t.Fatalf("Redeem() error = %v", err)
	}

	actorID, ok := store.Lookup(token)
	if !ok {
		t.Fatal("Lookup() ok = false, want true")
	}
	if actorID != "actor-42" {
		t.Fatalf("Lookup() actorID = %q, want actor-42", actorID)
	}

	if _, ok := store.Lookup("not-a-real-token"); ok {
		t.Fatal("Lookup() of an unknown token = true, want false")
	}
}

func TestTokenExpiresAfterTTL(t *testing.T) {
	store, clock := newTestStore()
	code, _ := store.Issue("actor-1")
	token, _, _, err := store.Redeem(code)
	if err != nil {
		t.Fatalf("Redeem() error = %v", err)
	}

	clock.now = clock.now.Add(tokenTTL + time.Second)

	if _, ok := store.Lookup(token); ok {
		t.Fatal("Lookup() after token expiry = true, want false")
	}
}
