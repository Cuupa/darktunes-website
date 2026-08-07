/**
 * Tell Lenis to yield wheel/touch events to nested native scroll.
 *
 * Prefer explicit `data-lenis-prevent` on real scrollports (ScrollPanel, dialogs, tables).
 * Fallback: only elements that actually overflow (computed overflow + scroll metrics) —
 * never match Tailwind class substrings like `overflow-x-auto` alone (responsive grids
 * keep that token in the class string while `md:overflow-x-visible` wins on desktop).
 */
export function shouldPreventLenis(node: Element): boolean {
  if (node.closest('[data-lenis-prevent]')) return true
  if (node.closest('[data-slot="scroll-area-viewport"]')) return true

  let el: Element | null = node
  while (el && el !== document.documentElement) {
    if (el instanceof HTMLElement && isActuallyScrollable(el)) return true
    el = el.parentElement
  }
  return false
}

function isActuallyScrollable(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el)
  const ox = style.overflowX
  const oy = style.overflowY
  const canY = (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 1
  const canX = (ox === 'auto' || ox === 'scroll' || ox === 'overlay') && el.scrollWidth > el.clientWidth + 1
  return canY || canX
}