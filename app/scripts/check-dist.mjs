// Test the three rules that the build output must obey.
//
// Each of these was a real failure mode, and none of them shows up as a
// build error. They show up as a blank page in production, so they are
// tested here and in CI.
//
// Run: node scripts/check-dist.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')

const failures = []

function fail(rule, detail) {
  failures.push(`${rule}\n    ${detail}`)
}

const html = readFileSync(join(DIST, 'index.html'), 'utf8')

// Rule 1. The relay sends Content-Security-Policy "default-src 'self'"
// with no nonce and no hash, so an inline script or an inline style is
// refused. @vitejs/plugin-legacy and vite-plugin-pwa both add one.
const inlineScript = /<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?<\/script>/i.exec(html)
if (inlineScript) fail('inline script in index.html', inlineScript[0].slice(0, 120))

const inlineStyle = /<style[^>]*>/i.exec(html)
if (inlineStyle) fail('inline style in index.html', inlineStyle[0])

// Rule 2. A proxy can serve the page under a path that the relay never
// learns, so an address that starts with "/" would leave that path. Vite
// writes "./..." when base is "./"; anything else means base changed.
for (const match of html.matchAll(/(?:src|href)="([^"]*)"/g)) {
  const value = match[1]
  if (value.startsWith('./') || value.startsWith('data:')) continue
  fail('address in index.html is not relative', value)
}

// Rule 3. src/core/transport/base.ts finds the root of the application
// with new URL('../', import.meta.url), so every JS chunk must sit exactly
// one directory below the root. A nested chunk makes the root wrong, and
// every address in the page with it.
function walk(dir, depth) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, depth + 1)
      continue
    }
    if (entry.endsWith('.js') && depth > 0) {
      fail('JS chunk is not flat under assets/', full.replace(DIST, 'dist'))
    }
  }
}
walk(join(DIST, 'assets'), 0)

if (failures.length > 0) {
  console.error('The build output broke a rule:\n')
  for (const failure of failures) console.error(`  - ${failure}\n`)
  process.exit(1)
}

console.log('dist is correct: no inline script or style, every address relative, chunks flat.')
