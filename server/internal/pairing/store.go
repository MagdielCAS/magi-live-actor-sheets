// Package pairing holds pairing codes and device tokens in memory. A code
// lets one device redeem one token for one actor. Everything here lives in
// process memory; nothing survives a restart.
package pairing

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"math/big"
	"sync"
	"time"
)

const (
	codeDigits = 6
	codeTTL    = 3 * time.Minute
	tokenTTL   = 30 * 24 * time.Hour
	tokenBytes = 32
)

// ErrCodeNotFound means the code does not exist, already expired, or was
// already redeemed.
var ErrCodeNotFound = errors.New("pairing: code not found or expired")

type codeEntry struct {
	code      string
	actorID   string
	expiresAt time.Time
}

type tokenEntry struct {
	token     string
	actorID   string
	expiresAt time.Time
}

// Store holds pairing codes and device tokens. A Store is safe for
// concurrent use.
type Store struct {
	mu     sync.Mutex
	clock  func() time.Time
	codes  map[string]codeEntry
	tokens map[string]tokenEntry
}

// NewStore makes an empty Store. clock lets a test control what "now"
// means; pass time.Now in production.
func NewStore(clock func() time.Time) *Store {
	return &Store{
		clock:  clock,
		codes:  make(map[string]codeEntry),
		tokens: make(map[string]tokenEntry),
	}
}

// Issue makes a new 6-digit pairing code for actorID. The code expires
// after 3 minutes and is valid for one redemption.
func (s *Store) Issue(actorID string) (code string, expiresAt time.Time) {
	now := s.clock()
	expiresAt = now.Add(codeTTL)

	s.mu.Lock()
	defer s.mu.Unlock()
	s.purgeLocked(now)

	code = randomDigits(codeDigits)
	for {
		if _, taken := s.codes[code]; !taken {
			break
		}
		code = randomDigits(codeDigits)
	}
	s.codes[code] = codeEntry{code: code, actorID: actorID, expiresAt: expiresAt}
	return code, expiresAt
}

// Redeem exchanges a pairing code for a device token. The code is deleted
// whether or not the exchange succeeds, so a code never redeems twice.
func (s *Store) Redeem(code string) (token, actorID string, expiresAt time.Time, err error) {
	now := s.clock()

	s.mu.Lock()
	defer s.mu.Unlock()
	s.purgeLocked(now)

	entry, ok := s.codes[code]
	if ok {
		delete(s.codes, code)
	}
	if !ok || now.After(entry.expiresAt) || subtle.ConstantTimeCompare([]byte(entry.code), []byte(code)) != 1 {
		return "", "", time.Time{}, ErrCodeNotFound
	}

	tok, err := randomToken()
	if err != nil {
		return "", "", time.Time{}, fmt.Errorf("pairing: make a device token: %w", err)
	}
	expiresAt = now.Add(tokenTTL)
	s.tokens[tok] = tokenEntry{token: tok, actorID: entry.actorID, expiresAt: expiresAt}
	return tok, entry.actorID, expiresAt, nil
}

// Lookup resolves a device token to the actor it names. ok is false when
// the token is unknown or expired.
func (s *Store) Lookup(token string) (actorID string, ok bool) {
	now := s.clock()

	s.mu.Lock()
	defer s.mu.Unlock()
	s.purgeLocked(now)

	entry, found := s.tokens[token]
	if !found || now.After(entry.expiresAt) {
		return "", false
	}
	if subtle.ConstantTimeCompare([]byte(entry.token), []byte(token)) != 1 {
		return "", false
	}
	return entry.actorID, true
}

// purgeLocked drops every expired code and token. Call it with mu held.
func (s *Store) purgeLocked(now time.Time) {
	for code, entry := range s.codes {
		if now.After(entry.expiresAt) {
			delete(s.codes, code)
		}
	}
	for token, entry := range s.tokens {
		if now.After(entry.expiresAt) {
			delete(s.tokens, token)
		}
	}
}

// randomDigits makes an n-digit numeric string using crypto/rand. It uses
// rand.Int, which rejects out-of-range draws internally, so the result is
// uniform with no modulo bias.
func randomDigits(n int) string {
	limit := big.NewInt(1)
	ten := big.NewInt(10)
	for i := 0; i < n; i++ {
		limit.Mul(limit, ten)
	}
	v, err := rand.Int(rand.Reader, limit)
	if err != nil {
		// The system random source is broken. There is no safe way to
		// carry on issuing pairing codes.
		panic("pairing: system random source failed: " + err.Error())
	}
	return fmt.Sprintf("%0*d", n, v.Int64())
}

// randomToken makes a 32-byte token encoded as base64url text.
func randomToken() (string, error) {
	b := make([]byte, tokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
