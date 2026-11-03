/** Which landing block a hash section should scroll to. */
export function landingSectionElementId(head: string, wide: boolean): string {
  if (head === 'roi') return 'roi-calculator';
  if (head === 'demo') return 'demo';
  if (head === 'faq') return 'signal-faq';
  return wide ? 'ring-studio-hero' : 'ring-studio';
}

/**
 * Demo scrolls its heading, not the section box. The section's top padding would leave the title
 * a long way down the viewport. Other sections already use scroll-margin on the section itself.
 */
export function scrollTargetFor(root: ParentNode, sectionId: string): HTMLElement | null {
  const section = root.querySelector<HTMLElement>(`#${sectionId}`);
  if (!section) return null;
  if (sectionId === 'demo') return section.querySelector<HTMLElement>('h1, h2') ?? section;
  return section;
}

/** Scroll offset that puts `targetTop` (viewport y) at `scrollMarginTop` inside the container. */
export function scrollTopFor(containerTop: number, containerScrollTop: number, targetTop: number, scrollMarginTop: number): number {
  return Math.max(0, targetTop - containerTop + containerScrollTop - scrollMarginTop);
}

let cancelActivePin: (() => void) | null = null;

/**
 * Put the section (or, for #demo, its heading) at the top of the scroll container, then keep
 * putting it there while lazy content above it changes height. A poster that later becomes a
 * 112vh ring track was leaving #demo about one screen below the fold on phones.
 * Stops when the reader scrolls, or after the layout has had time to settle.
 */
export function pinScrollTarget(container: HTMLElement, sectionId: string): boolean {
  const target = scrollTargetFor(container, sectionId);
  if (!target) return false;
  cancelActivePin?.();

  let stopped = false;
  const timers: number[] = [];
  let content: HTMLElement = target;
  while (content.parentElement && content.parentElement !== container) content = content.parentElement;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer?.disconnect();
    timers.forEach((id) => window.clearTimeout(id));
    window.removeEventListener('wheel', onUser);
    window.removeEventListener('touchstart', onUser);
    window.removeEventListener('keydown', onUser);
    if (cancelActivePin === stop) cancelActivePin = null;
  };

  const align = () => {
    if (stopped) return;
    const live = scrollTargetFor(container, sectionId);
    if (!live) return;
    const margin = Number.parseFloat(getComputedStyle(live).scrollMarginTop) || 0;
    const top = scrollTopFor(container.getBoundingClientRect().top, container.scrollTop, live.getBoundingClientRect().top, margin);
    if (Math.abs(container.scrollTop - top) > 1) container.scrollTo({ top, behavior: 'auto' });
  };

  const onUser = () => stop();

  let observer: ResizeObserver | undefined;
  window.addEventListener('wheel', onUser, { passive: true });
  window.addEventListener('touchstart', onUser, { passive: true });
  window.addEventListener('keydown', onUser);
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => align());
    observer.observe(content);
  }
  align();
  // The ring chunk (and anything else above the target) can commit well after the first scroll.
  for (const delay of [50, 150, 400, 800, 1500, 2500, 4000, 6000]) {
    timers.push(window.setTimeout(align, delay));
  }
  timers.push(window.setTimeout(stop, 7000));
  cancelActivePin = stop;
  return true;
}
