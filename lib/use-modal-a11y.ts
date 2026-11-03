import { useEffect, useRef, type RefObject } from 'react';
import { useEscapeClose } from './use-escape-close';

/**
 * Modal dialog behaviour for the AR sheet and the ring try-on (WAI-ARIA dialog pattern):
 *  - focus moves into the dialog on open (initialFocusRef, else the first focusable control, else the dialog itself)
 *  - Tab / Shift+Tab cycle inside the dialog; focus that somehow lands outside is pulled back in
 *  - Escape closes
 *  - everything else attached to <body> becomes `inert` + `aria-hidden="true"` while open, and is restored exactly on close
 *  - focus returns to the element that opened the dialog (the trigger) on close
 *
 * The dialog must be rendered somewhere under <body>; it is portalled there by RingBuilder. Siblings of the dialog's
 * top-level ancestor are the "rest of the page".
 */
const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

export function getTabbable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute('hidden') || el.closest('[hidden], [inert]')) return false;
    const tab = el.getAttribute('tabindex');
    if (tab !== null && Number(tab) < 0) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    // sr-only inputs have a 1px box but are still tabbable, so test "rendered" rather than "has size"
    return el.getClientRects().length > 0;
  });
}

type Saved = { el: Element; inert: boolean; ariaHidden: string | null };

export function useModalA11y(dialogRef: RefObject<HTMLElement | null>, onClose: () => void, initialFocusRef?: RefObject<HTMLElement | null>) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose; // always call the latest handler without rebuilding the trap on every parent render
  useEscapeClose(true, () => onCloseRef.current(), 1500);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // 1) rest of the page: inert + aria-hidden
    let top: HTMLElement = dialog;
    while (top.parentElement && top.parentElement !== document.body) top = top.parentElement;
    const saved: Saved[] = [];
    Array.from(document.body.children).forEach((el) => {
      if (el === top || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') return;
      saved.push({ el, inert: (el as HTMLElement).inert === true, ariaHidden: el.getAttribute('aria-hidden') });
      (el as HTMLElement).inert = true;
      el.setAttribute('aria-hidden', 'true');
    });

    // 2) initial focus
    const focusIn = () => {
      const target = initialFocusRef?.current ?? getTabbable(dialog)[0] ?? dialog;
      target.focus({ preventScroll: true });
    };
    focusIn();

    // 3) Escape + Tab trap (capture so model-viewer / inputs cannot swallow it)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = getTabbable(dialog);
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && dialog.contains(active);
      if (e.shiftKey && (!inside || active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    // 4) safety net for focus that escapes by any other route (programmatic focus, assistive tech)
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof Node && !dialog.contains(e.target)) focusIn();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocusIn);
      saved.forEach(({ el, inert, ariaHidden }) => {
        (el as HTMLElement).inert = inert;
        if (ariaHidden === null) el.removeAttribute('aria-hidden');
        else el.setAttribute('aria-hidden', ariaHidden);
      });
      if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
    // mount/unmount only: the trap and the inert bookkeeping must not be rebuilt while the dialog stays open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
