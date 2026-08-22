// A small, explicit HTML sanitizer for the biography field.
//
// This is the only place that turns a Foundry HTML string into DOM. It uses
// an allowlist: it keeps the tags and the attributes in the two tables
// below, and it removes everything else. An allowlist is safer than a list
// of bad tags, because a tag that nobody thought about is removed and not
// kept.
//
// DOMParser does not run a script and does not load a resource, so it is
// safe to parse the text before the removal step.
//
// This file also keeps the Content-Security-Policy of the relay defensible:
// it removes every style attribute, so biography HTML cannot carry a style.
// Send every string through this function before it reaches v-html.

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'div', 'span',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark', 'small',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'blockquote', 'pre', 'code',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'a', 'img', 'figure', 'figcaption',
])

// The attributes that each allowed tag may keep. Anything else goes, and
// that includes every "on*" event attribute and every style attribute.
const ALLOWED_ATTRS: Record<string, readonly string[]> = {
  a: ['href', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope'],
}

// A URL is safe only if it uses one of these schemes, or if it is relative.
const SAFE_URL = /^(https?:|mailto:|#|\/|\.{0,2}\/)/i

export function sanitizeHtml(rawHtml: string | null | undefined): string {
  const doc = new DOMParser().parseFromString(String(rawHtml ?? ''), 'text/html')
  clean(doc.body)
  return doc.body.innerHTML
}

function clean(root: HTMLElement): void {
  // Walk a static list, because the loop changes the tree.
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (!el.isConnected) continue

    const tag = el.tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) {
      // Keep the text of a tag that only adds layout, but drop a tag that
      // can carry an action or another document.
      if (tag === 'script' || tag === 'style' || tag === 'template') el.remove()
      else el.replaceWith(...Array.from(el.childNodes))
      continue
    }

    const allowed = ALLOWED_ATTRS[tag] ?? []
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      if (!allowed.includes(name)) {
        el.removeAttribute(attr.name)
        continue
      }
      if ((name === 'href' || name === 'src') && !SAFE_URL.test(attr.value.trim())) {
        el.removeAttribute(attr.name)
      }
    }

    // An external link must not give the new page control of this one.
    if (tag === 'a' && el.hasAttribute('href')) {
      el.setAttribute('rel', 'noopener noreferrer')
      el.setAttribute('target', '_blank')
    }
  }
}
