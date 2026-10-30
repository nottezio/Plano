/** The element that scrolls the page vertically around `node` (#main in the app). */
export function scrollParentOf(node: HTMLElement): Element {
  for (let at = node.parentElement; at; at = at.parentElement) {
    const { overflowY } = getComputedStyle(at);
    if ((overflowY === 'auto' || overflowY === 'scroll') && at.scrollHeight > at.clientHeight) return at;
  }
  return document.scrollingElement ?? document.documentElement;
}
