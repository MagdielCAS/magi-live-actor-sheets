/* Lucide icons, v0.544.0, ISC licence. https://lucide.dev
 *
 * The page is served with a Content-Security-Policy of default-src 'self',
 * and it must also draw on a table with no route to the internet. So the
 * icons live here and not on a content delivery network.
 *
 * This file holds only the icons the page draws. The path data is copied
 * without change from the lucide package. The interface is the interface
 * of the lucide UMD build — lucide.createIcons() replaces every element
 * that has a data-lucide attribute — so a change to the full package is
 * one line in index.html.
 */

(function (global) {
  'use strict';

  const ICONS = {
    'heart-pulse':
      '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>' +
      '<path d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
    swords:
      '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>' +
      '<line x1="13" x2="19" y1="19" y2="13"/>' +
      '<line x1="16" x2="20" y1="16" y2="20"/>' +
      '<line x1="19" x2="21" y1="21" y2="19"/>' +
      '<polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/>' +
      '<line x1="5" x2="9" y1="14" y2="18"/>' +
      '<line x1="7" x2="4" y1="17" y2="20"/>' +
      '<line x1="3" x2="5" y1="19" y2="21"/>',
    sparkles:
      '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>' +
      '<path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
    backpack:
      '<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>' +
      '<path d="M8 10h8"/><path d="M8 18h8"/>' +
      '<path d="M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6"/>' +
      '<path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
    'scroll-text':
      '<path d="M15 12h-5"/><path d="M15 8h-5"/>' +
      '<path d="M19 17V5a2 2 0 0 0-2-2H4"/>' +
      '<path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/>',
    'notebook-pen':
      '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/>' +
      '<path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/>' +
      '<path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/>',
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Build one icon. The size comes from CSS, so the element carries no
  // width and no height. The stroke is currentColor, so an icon takes the
  // colour of the word beside it.
  function makeIcon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    // Every icon of this page sits beside its own word, so a reader that
    // speaks the page must skip it.
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.innerHTML = ICONS[name];
    return svg;
  }

  // Replace every element that names an icon. An unknown name leaves the
  // element as it is and says so, because a silent miss costs a debugging
  // round trip.
  function createIcons(options) {
    const root = (options && options.root) || document;
    for (const holder of root.querySelectorAll('[data-lucide]')) {
      const name = holder.dataset.lucide;
      if (!ICONS[name]) {
        console.warn('lucide: this build does not hold the icon', name);
        continue;
      }
      holder.replaceChildren(makeIcon(name));
    }
  }

  global.lucide = { icons: ICONS, createIcons };
})(window);
