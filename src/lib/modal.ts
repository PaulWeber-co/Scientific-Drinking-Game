import { useLayoutEffect, useRef, type RefObject } from 'react';

const stack: HTMLElement[] = [];
let previousOverflow = '';
const focusable = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Gemeinsam fuer Sheets und Einladungen: nur die oberste Ebene reagiert. */
export function useModalDialog(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    const opener = document.activeElement instanceof HTMLElement && !el.contains(document.activeElement)
      ? document.activeElement : null;
    if (stack.length === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    stack.push(el);
    const top = () => stack[stack.length - 1] === el;
    const items = () => [...el.querySelectorAll<HTMLElement>(focusable)].filter((item) =>
      !item.closest('[hidden], [inert], [aria-hidden="true"]') && getComputedStyle(item).display !== 'none' && getComputedStyle(item).visibility !== 'hidden',
    );
    const focusFirst = () => (items()[0] ?? el).focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (!top() || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      } else if (event.key === 'Tab') {
        const buttons = items();
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (!first) { event.preventDefault(); el.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === el)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (top() && event.target instanceof Node && !el.contains(event.target)) focusFirst();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocus);
    if (!el.contains(document.activeElement)) focusFirst();
    return () => {
      const wasTop = top();
      const index = stack.indexOf(el);
      if (index >= 0) stack.splice(index, 1);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocus);
      if (!stack.length) document.body.style.overflow = previousOverflow;
      if (wasTop) {
        const parent = stack[stack.length - 1];
        if (opener?.isConnected && (!parent || parent.contains(opener))) opener.focus({ preventScroll: true });
        else parent?.focus({ preventScroll: true });
      }
    };
  }, [open, ref]);
}
