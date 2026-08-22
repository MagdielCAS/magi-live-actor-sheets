<script setup lang="ts">
// The session starts here, from the query string, exactly as web/app.js
// did. Three ways in, and they are tried in this order:
//
//   ?fixture=1        draw the example character, no socket at all
//   ?actorId=<id>     LAN mode, the relay trusts the address
//   a stored token    a device that paired before
//
// Anything else goes to the pairing screen, which the router guard does.

import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConnectionStore } from '@/stores/connection'
import { useCharacterStore } from '@/stores/character'
import { readToken } from '@/core/transport/pairing'
import AppLayout from '@/layouts/AppLayout.vue'
import ToastHost from '@/components/common/ToastHost.vue'

const connection = useConnectionStore()
const character = useCharacterStore()
const router = useRouter()

// A device that paired before knows its token, not its actor. The first
// snapshot brings the actor id, and that is the moment the sheet can open.
watch(
  () => character.actorId,
  async (actorId) => {
    if (!actorId) return
    if (router.currentRoute.value.name !== 'boot') return
    await router.replace({ name: 'sheet.stats', params: { actorId } })
  },
)

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)

  if (params.get('fixture') === '1') {
    // The example character is only in the build for this mode, so it is
    // an import() and it leaves the main chunk.
    const { fixtureSheet } = await import('@/dev/fixture')
    const sheet = fixtureSheet()
    connection.useFixture(sheet)
    await router.replace({ name: 'sheet.stats', params: { actorId: sheet.id } })
    return
  }

  const actorId = params.get('actorId')
  if (actorId) {
    connection.connect({ actorId })
    await router.replace({ name: 'sheet.stats', params: { actorId } })
    return
  }

  const token = readToken()
  if (token && !params.get('c')) {
    connection.connect({ token })
    return
  }

  await router.replace({ name: 'pair' })
})
</script>

<template>
  <AppLayout />
  <ToastHost />
</template>
