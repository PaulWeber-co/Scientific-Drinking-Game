import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * QR-Code als reines SVG – skaliert verlustfrei und passt sich dem Theme an.
 * Fehlerkorrektur "M" ist der übliche Kompromiss: verträgt Fingerabdrücke auf
 * dem Display, bleibt aber kompakt genug für einen Lobby-Link.
 */
export function QrCode({
  value,
  size = 200,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
      }
    }
    return { path: d, count: n };
  }, [value]);

  const quiet = 2;
  const total = count + quiet * 2;

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      className={`qr ${className ?? ''}`}
      role="img"
      aria-label="QR-Code zur Lobby"
      shapeRendering="crispEdges"
    >
      <rect width={total} height={total} rx="2" fill="#fff" />
      <g transform={`translate(${quiet} ${quiet})`} fill="#000">
        <path d={path} />
      </g>
    </svg>
  );
}
