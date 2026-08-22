// Pairing. The GM screen shows a 6-digit code, the phone sends it here,
// and the relay answers with a token for one actor. protocol.md section 7.

import { appUrl } from './base'
import { toErrorPayload } from '../protocol/guards'
import type { ErrorPayload } from '../protocol/messages'

/** The key that holds the pairing token between visits. */
export const TOKEN_KEY = 'magi.token'

export interface PairResult {
  token: string
  actorId: string
  expiresAt: string
}

/**
 * Exchange a pairing code for a token. The code has one use and is valid
 * for three minutes.
 */
export async function pair(code: string): Promise<PairResult> {
  let response: Response
  try {
    response = await fetch(appUrl('api/pair').toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    })
  } catch (cause) {
    const failure: ErrorPayload = toErrorPayload(cause, 'network')
    console.warn(`magi: the pairing request did not reach the relay. ${failure.message}`)
    throw failure
  }

  if (!response.ok) {
    const failure: ErrorPayload = {
      code: `http_${response.status}`,
      message:
        response.status === 404 || response.status === 410
          ? 'That code is not valid. Ask your GM for a new one.'
          : 'The relay refused the code.',
    }
    console.warn(`magi: pairing failed. status=${response.status}`)
    throw failure
  }

  return (await response.json()) as PairResult
}

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    // A browser can refuse storage in a private window.
    return null
  }
}

export function writeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    console.warn('magi: this browser refused to keep the pairing token.')
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing to do.
  }
}
