<script setup lang="ts">
// The 6-digit code from the GM screen. protocol.md section 7.

import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { pair, writeToken } from '@/core/transport/pairing'
import { useConnectionStore } from '@/stores/connection'
import type { ErrorPayload } from '@/core/protocol/messages'

const router = useRouter()
const connection = useConnectionStore()

const code = ref('')
const error = ref('')
const busy = ref(false)

onMounted(() => {
  // A pairing link carries the code as "?c=123456". The name is fixed by
  // protocol.md section 7.4.
  const fromUrl = new URLSearchParams(window.location.search).get('c')
  if (fromUrl) code.value = fromUrl
})

async function submit(): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await pair(code.value.trim())
    writeToken(result.token)
    connection.connect({ token: result.token })
    await router.replace({ name: 'sheet.stats', params: { actorId: result.actorId } })
  } catch (cause) {
    error.value = (cause as ErrorPayload).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-sm">
    <h1 class="text-center text-2xl font-semibold">Magi Live Sheet</h1>
    <p class="mt-2 text-center text-sm text-muted-foreground">
      Enter the 6-digit code from your GM's screen.
    </p>

    <form class="mt-6 flex flex-col gap-3" autocomplete="off" @submit.prevent="submit">
      <input
        v-model="code"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="6"
        placeholder="000000"
        aria-label="Pairing code"
        required
        class="w-full rounded-lg border border-input bg-card px-4 py-3 text-center text-2xl
               tracking-[0.4em] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
      <button
        type="submit"
        :disabled="busy"
        class="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground
               disabled:opacity-60"
      >
        {{ busy ? 'Pairing…' : 'Pair' }}
      </button>
    </form>

    <p v-if="error" role="alert" class="mt-3 text-center text-sm text-destructive">
      {{ error }}
    </p>
  </div>
</template>
