import React, { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** Dependency-light QR (inline SVG, black on white for reliable scanning). Generated locally — the URL never leaves the page. */
export const QrCodeSvg: React.FC<{ value: string; size?: number; label?: string }> = ({ value, size = 168, label = 'QR code' }) => {
  const { count, dark } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const cells: string[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cells.push(`M${c} ${r}h1v1h-1z`);
    return { count: n, dark: cells.join('') };
  }, [value]);
  const quiet = 3;
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`${-quiet} ${-quiet} ${count + quiet * 2} ${count + quiet * 2}`}
      shapeRendering="crispEdges"
      className="rounded-xl bg-white"
    >
      <path d={dark} fill="#000" />
    </svg>
  );
};
