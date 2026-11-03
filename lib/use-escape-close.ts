import { useEffect, useRef } from 'react';

type Entry = { z: number; close: () => void };

const stack: Entry[] = [];

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented || stack.length === 0) return;
  let top = stack[0];
  for (const entry of stack) if (entry.z >= top.z) top = entry;
  e.preventDefault();
  e.stopPropagation();
  top.close();
}

let bound = false;

function ensureBound() {
  if (bound || typeof document === 'undefined') return;
  document.addEventListener('keydown', onKey, true);
  bound = true;
}

/** Close the topmost open overlay on Escape. Higher z wins; equal z closes the most recently opened. */
export function useEscapeClose(active: boolean, close: () => void, z: number) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!active) return;
    ensureBound();
    const entry: Entry = { z, close: () => closeRef.current() };
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active, z]);
}
