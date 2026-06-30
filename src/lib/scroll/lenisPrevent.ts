const OVERFLOW_SCROLL_SELECTOR =
  '[class*="overflow-y-auto"],[class*="overflow-x-auto"],[class*="overflow-auto"],[class*="overflow-y-scroll"],[class*="overflow-x-scroll"]'

/** Tell Lenis to yield wheel/touch events to native scroll inside these containers. */
export function shouldPreventLenis(node: Element): boolean {
  if (node.closest('[data-lenis-prevent]')) return true
  if (node.closest('[data-slot="scroll-area-viewport"]')) return true
  if (node.closest(OVERFLOW_SCROLL_SELECTOR)) return true
  return false
}