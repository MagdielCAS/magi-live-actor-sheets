// The socket, and what the page knows about it.
//
// The WSClient itself lives in a plain variable, never in reactive state.
// A WebSocket inside a reactive proxy is a source of silent faults, and
// nothing in the page needs to watch the object.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { WSClient } from '@/core/transport/ws-client'
import type { Auth, ConnectionStatus } from '@/core/transport/ws-client'
import type {
  ClientMessageType,
  ClientPayloadMap,
  ErrorPayload,
} from '@/core/protocol/messages'
import type { SheetDTO } from '@/core/protocol/sheet'
import { toErrorPayload } from '@/core/protocol/guards'
import { useCharacterStore } from './character'
import { useToastStore } from './toast'

/** "fixture" is the offline mode for layout work. It has no socket. */
export type PageStatus = ConnectionStatus | 'fixture'

let client: WSClient | null = null

export const useConnectionStore = defineStore('connection', () => {
  const status = ref<PageStatus>('offline')
  /** null until the relay says. */
  const bridgeOnline = ref<boolean | null>(null)

  const isLive = computed(() => status.value === 'live')
  const canSend = computed(() => status.value === 'live' || status.value === 'fixture')

  const badgeText = computed(() => {
    switch (status.value) {
      case 'fixture':
        return 'Fixture'
      case 'connecting':
        return 'Connecting'
      case 'reconnecting':
        return 'Reconnecting'
      case 'offline':
        return 'Offline'
      case 'live':
        return bridgeOnline.value === false ? 'GM offline' : 'Live'
    }
  })

  /** The state the badge shows. It keeps the names the old page used. */
  const badgeState = computed(() =>
    status.value === 'live' && bridgeOnline.value === false ? 'bridge-offline' : status.value,
  )

  function connect(auth: Auth): void {
    disconnect()

    const character = useCharacterStore()
    const toast = useToastStore()

    const next = new WSClient(auth)
    client = next

    next.on('connectionState', (state) => {
      status.value = state
    })
    next.on('bridgeState', (payload) => {
      bridgeOnline.value = payload.online
    })
    next.on('snapshot', (dto) => {
      character.applySnapshot(dto)
    })
    next.on('serverError', (payload) => {
      // The old page dropped an error with no request id without a word.
      toast.error(payload.message)
    })

    next.connect()
  }

  /** Offline mode. The page draws the example character and sends nothing. */
  function useFixture(sheet: SheetDTO): void {
    disconnect()
    status.value = 'fixture'
    bridgeOnline.value = null
    useCharacterStore().applySnapshot(sheet)
  }

  function disconnect(): void {
    client?.close()
    client = null
  }

  /**
   * Send one message. In fixture mode nothing goes out and the promise
   * resolves, so a component does not need to know which mode it is in.
   */
  async function send<K extends ClientMessageType>(
    type: K,
    payload: ClientPayloadMap[K],
  ): Promise<void> {
    if (status.value === 'fixture') return
    if (!client) {
      const failure: ErrorPayload = { code: 'offline', message: 'The page is not connected.' }
      throw failure
    }
    try {
      await client.send(type, payload)
    } catch (cause) {
      throw toErrorPayload(cause, 'send_failed')
    }
  }

  return {
    status,
    bridgeOnline,
    isLive,
    canSend,
    badgeText,
    badgeState,
    connect,
    useFixture,
    disconnect,
    send,
  }
})
