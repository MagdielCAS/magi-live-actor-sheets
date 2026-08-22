// A browser test against the REAL relay binary.
//
// This is the only place the production Content-Security-Policy is ever
// exercised. In development Vite serves the page and sends no CSP header
// at all, so a violation stays invisible until production. The relay sends
// "default-src 'self'" with no nonce and no hash, which refuses an inline
// script and an inline style.
//
// The test fails on any CSP violation and on any error in the page.
//
// Usage, with the relay already running on 127.0.0.1:30001:
//   node scripts/smoke.mjs [baseUrl]

import pkg from '/opt/node22/lib/node_modules/playwright/index.js'

const { chromium } = pkg
const BASE = process.argv[2] ?? 'http://127.0.0.1:30001'

const problems = []

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

page.on('pageerror', (error) => {
  problems.push(`page error: ${error.message}`)
})
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console error: ${message.text()}`)
})
await page.addInitScript(() => {
  document.addEventListener('securitypolicyviolation', (event) => {
    // eslint-disable-next-line no-console
    console.error(
      `CSP violation: ${event.violatedDirective} blocked ${event.blockedURI || '(inline)'}`,
    )
  })
})

const TABS = ['stats', 'combat', 'spells', 'inventory', 'features', 'bio']

try {
  // Fixture mode draws the example character with no socket, so this runs
  // with no Foundry and no bridge.
  await page.goto(`${BASE}/?fixture=1`, { waitUntil: 'networkidle' })
  // Both navigation bars are in the tree and Tailwind hides one, so ask
  // for the one that is actually visible at this width.
  await page
    .locator('nav[aria-label="Sheet tabs"]:visible')
    .first()
    .waitFor({ timeout: 10000 })

  const name = await page.textContent('body')
  if (!name?.includes('Aelar')) problems.push('the example character did not appear')

  for (const tab of TABS) {
    await page.goto(`${BASE}/?fixture=1#/sheet/fixture-aelar/${tab}`, {
      waitUntil: 'networkidle',
    })
    await page.waitForTimeout(200)
    const body = await page.textContent('body')
    if (!body || body.trim().length === 0) problems.push(`the ${tab} tab drew nothing`)
  }

  // The hit point field is the one that produced the write loop. Type in
  // it and confirm the draft survives.
  await page.goto(`${BASE}/?fixture=1#/sheet/fixture-aelar/stats`, { waitUntil: 'networkidle' })
  const input = page.locator('input[inputmode="numeric"]').first()
  await input.click()
  await input.fill('33')
  const drafted = await input.inputValue()
  if (drafted !== '33') problems.push(`the draft did not stay in the input: ${drafted}`)
} catch (error) {
  problems.push(`the run stopped: ${error.message}`)
} finally {
  await browser.close()
}

if (problems.length > 0) {
  console.error('The smoke test found problems:\n')
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log('smoke test passed: every tab drew, and there was no CSP violation.')
