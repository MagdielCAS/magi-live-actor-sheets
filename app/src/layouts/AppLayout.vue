<script setup lang="ts">
// The shell of the page.
//
// The change between the phone layout and the desktop layout is CSS only.
// Both navigation bars are in the tree and Tailwind hides one of them. That
// costs two small <nav> trees and it buys three things that matter more:
// nothing waits for JavaScript before the first paint, a rotation does not
// mount a component again, and there is no layout shift. useIsDesktop()
// exists for behaviour, never for this.
//
//   phone   a fixed bar at the bottom, inside the reach of a thumb
//   desktop a fixed rail on the left, and a column of contained width

import { useRoute } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()

/** The pairing screen and the wait screen carry no navigation. */
const showChrome = computed(() => route.meta['chrome'] !== false)
</script>

<template>
  <div class="flex min-h-[100dvh] flex-col bg-background text-foreground md:flex-row">
    <DesktopSidebar
      v-if="showChrome"
      class="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:border-border"
    />

    <div class="flex min-w-0 flex-1 flex-col">
      <TopBar v-if="showChrome" />

      <!-- The feed. Contained width on a desktop, full width on a phone.
           The bottom padding clears the fixed bar and the iOS home bar. -->
      <main
        class="mx-auto w-full max-w-3xl flex-1 px-4"
        :class="
          showChrome
            ? 'pb-[calc(var(--tabbar-height)+env(safe-area-inset-bottom,0px)+1rem)] pt-3 md:pb-8'
            : 'flex items-center justify-center'
        "
      >
        <!-- The tabs of the sheet keep themselves alive, inside
             SheetShell. This RouterView only swaps whole screens. -->
        <RouterView />
      </main>
    </div>

    <MobileTabBar
      v-if="showChrome"
      class="fixed inset-x-0 bottom-0 z-40 md:hidden"
    />
  </div>
</template>
