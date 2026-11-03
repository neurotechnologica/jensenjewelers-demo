/**
 * Card trio geometry. A DisplayCard is w-64 (sm: w-72, md: w-[22rem]) and the three cards are offset by 0 / 48 / 96 px of translate that
 * the grid doubles to 0 / 96 / 192 px, so the stack is card + 192 px wide and sits 96 px right of the box centre. The old fixed scale
 * (0.52 on phones) made the trio ~230 px wide on a 390 px screen. Now the scale is derived from the viewport so the trio fills the
 * screen width (minus 12 px margins) at any phone width, and a translate (also scaled) re-centres it. Computed once from the first
 * render: nothing re-lays out after the entrance starts, so no card can jump.
 */
export function splashTrioLayout(vw: number): { scale: number; shiftPx: number } {
  const cardW = vw >= 768 ? 352 : vw >= 640 ? 288 : 256;
  const stackW = cardW + 192;
  const cap = vw >= 768 ? 0.9 : vw >= 640 ? 0.85 : 1;
  const scale = Math.max(0.5, Math.min(cap, (vw - 24) / stackW));
  return { scale: +scale.toFixed(3), shiftPx: +(-96 * scale).toFixed(1) };
}
