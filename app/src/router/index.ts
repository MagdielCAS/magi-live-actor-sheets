// The router.
//
// It uses a hash history on purpose. The relay answers any path it does not
// know with index.html, and a proxy can put the page under a path such as
// /magi/ that the relay never learns. With a path history the browser would
// ask for ./assets/... from a deep path, get index.html back with
// Content-Type text/html, and refuse the module because of nosniff. The
// page would be blank with no JavaScript running to explain it.
//
// A hash keeps the path of the document at the root of the application, so
// every relative address stays correct. Every entry point of this product
// is already the root plus a query string (?c=, ?actorId=, ?fixture=1), so
// nothing is lost.
//
// The base MUST be given. Vue Router defaults the base of a hash history to
// location.pathname + location.search, which would keep the pairing code of
// "?c=123456" in every address after it, long after the code is used.

import { createRouter, createWebHashHistory } from 'vue-router'
import { appPathname } from '@/core/transport/base'
import { routes } from './routes'
import { useCharacterStore } from '@/stores/character'
import { useConnectionStore } from '@/stores/connection'
import { readToken } from '@/core/transport/pairing'

export const router = createRouter({
  history: createWebHashHistory(appPathname()),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

// A device that has no way to identify itself belongs on the pairing
// screen. The query string decides, exactly as web/app.js did.
router.beforeEach((to) => {
  if (to.name === 'pair' || to.name === 'boot') return true

  const params = new URLSearchParams(window.location.search)
  if (params.get('fixture') === '1') return true
  if (params.get('actorId')) return true
  if (readToken()) return true

  const connection = useConnectionStore()
  const character = useCharacterStore()
  if (connection.status === 'fixture' || character.loaded) return true

  return { name: 'pair' }
})
