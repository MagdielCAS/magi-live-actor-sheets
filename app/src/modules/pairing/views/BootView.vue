<script setup lang="ts">
// A device that paired before has a token, but it learns which actor the
// token belongs to only when the first snapshot arrives. This is that wait.
// App.vue moves on as soon as the actor id is known.

import { useConnectionStore } from '@/stores/connection'

const connection = useConnectionStore()
</script>

<template>
  <div class="text-center">
    <p class="text-sm text-muted-foreground">
      {{ connection.status === 'offline' ? 'Not connected.' : 'Opening your sheet…' }}
    </p>
  </div>
</template>
