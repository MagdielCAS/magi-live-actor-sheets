import path from 'node:path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

// The relay serves this build. Two rules come from that server:
//
//   - Every address must be relative. A proxy can put the page under a
//     path, for example https://host/magi/, and the relay never learns
//     that path. See src/core/transport/base.ts.
//   - The router uses a hash, so the path of the document is always the
//     root of the application. That is what makes a relative base safe:
//     the server answers an unknown path with the page itself, so a
//     deep path would make every asset address wrong.
export default defineConfig(({ command }) => ({
  base: './',

  plugins: [
    vue(),
    tailwindcss(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
      dirs: ['src/composables', 'src/stores'],
      dts: 'src/auto-imports.d.ts',
      vueTemplate: true,
    }),
    Components({
      dirs: ['src/components', 'src/layouts'],
      dts: 'src/components.d.ts',
      extensions: ['vue'],
      deep: true,
    }),
  ],

  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },

  build: {
    // app/dist. The dist/ at the root of the repository belongs to the
    // release workflow, which writes module.json and module.zip there.
    outDir: 'dist',

    // Phones and current desktop browsers only.
    target: 'es2022',

    // Every JS chunk must stay flat, one directory below the root of the
    // application. src/core/transport/base.ts finds that root with
    // new URL('../', import.meta.url). A nested chunk would make the root
    // wrong, and every address in the page with it. A CI step tests this.
    assetsDir: 'assets',

    cssCodeSplit: true,
    sourcemap: command === 'build' ? 'hidden' : true,

    // The es2022 target has modulepreload everywhere, so the polyfill is
    // dead weight.
    modulePreload: { polyfill: false },

    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Keep the split small. The relay sends no Cache-Control for the
        // moment, so each added chunk is one more request that a phone
        // cannot use again. Icons get no chunk of their own: with a named
        // import they go into the chunk of the route that uses them, and
        // a shared chunk would undo that.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (/[\\/](vue|@vue|vue-router|pinia)[\\/]/.test(id)) return 'vendor-core'
          if (/[\\/](reka-ui|@floating-ui|aria-hidden)[\\/]/.test(id)) return 'vendor-ui'
          if (/[\\/]@internationalized[\\/]/.test(id)) return 'vendor-intl'
          return 'vendor'
        },
      },
    },
  },

  // NOTE for a later change: do not add a `drop` option for console calls,
  // here or under `oxc`. This project writes a log line for every refusal
  // and every give-up on purpose. A browser turns a failed WebSocket
  // handshake into close code 1006 with no reason, and the log is the only
  // thing that can explain it. Keeping the calls is the default, so there
  // is nothing to configure; there is only something not to add.

  server: {
    proxy: {
      '/api': 'http://127.0.0.1:30001',
      '/ws': { target: 'ws://127.0.0.1:30001', ws: true },
    },
  },

  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
}))
