/** Polar helpers for react-native-svg arc paths (web Arc/Donut parity). */

export function polarXY(cx: number, cy: number, r: number, angleRad: number): { x: number; y: number } {
  return {
    x: cx + r * Math.sin(angleRad),
    y: cy - r * Math.cos(angleRad),
  };
}

export function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarXY(cx, cy, r, startAngle);
  const end = polarXY(cx, cy, r, endAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

/** d3.arc() annular band — same geometry as web Arc track/fill. */
export function describeAnnularArc(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  return describeDonutSegment(cx, cy, innerR, outerR, startAngle, endAngle);
}

export function describeDonutSegment(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const oStart = polarXY(cx, cy, outerR, startAngle);
  const oEnd = polarXY(cx, cy, outerR, endAngle);
  const iEnd = polarXY(cx, cy, innerR, endAngle);
  const iStart = polarXY(cx, cy, innerR, startAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${iStart.x} ${iStart.y}`,
    'Z',
  ].join(' ');
}

/** Web Arc component span: -π/1.08 … +π/1.08 */
export const ARC_START = -Math.PI / 1.08;
export const ARC_END = Math.PI / 1.08;
export const ARC_SPAN = ARC_END - ARC_START;
