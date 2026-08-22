package hub

import "testing"

func TestPairingURL(t *testing.T) {
	cases := []struct {
		name    string
		baseURL string
		want    string
	}{
		{
			// A proxy that serves the relay under a path removes that
			// path before the request arrives. The public URL setting
			// puts it back, and the code must follow it.
			name:    "under a path",
			baseURL: "https://foundry.example.com/magi",
			want:    "https://foundry.example.com/magi/?c=123456",
		},
		{
			name:    "under a path with a final slash",
			baseURL: "https://foundry.example.com/magi/",
			want:    "https://foundry.example.com/magi/?c=123456",
		},
		{
			name:    "at the root of a domain",
			baseURL: "https://magi.example.com",
			want:    "https://magi.example.com/?c=123456",
		},
		{
			name:    "on the local network",
			baseURL: "http://192.168.1.10:30001",
			want:    "http://192.168.1.10:30001/?c=123456",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := pairingURL(tc.baseURL, "123456"); got != tc.want {
				t.Errorf("pairingURL(%q) = %q, want %q", tc.baseURL, got, tc.want)
			}
		})
	}
}
