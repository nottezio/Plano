import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * The Analisis tab's charts (28 Oct 2026, Avi: "improve the Analisis tab, use
 * graph/curve if necessary"). Plain SVG, no library: the data is a handful of
 * small series and the app is offline-first.
 *
 * Mark specs: 2px lines with a smooth (monotone) curve, an area wash at about
 * 10%, bars at most 24px with a 2px rounded data end and a square foot, a 1px
 * recessive grid, ends and hovered points as 8px dots with a surface ring, a
 * value only at the end or the cap. Text wears text tokens, never the series
 * colour. Series colours are `--chart-1..3` (tokens.css), validated for
 * colour-vision separation in light, dark and Senja. Hover shows a crosshair
 * and a tooltip; the numbers are always available in the table beside them.
 */

const AXIS = 'var(--fg-muted)';
const GRID = 'var(--border)';
const SURFACE = 'var(--surface)';

/** Width of a box, tracked: the chart is drawn at the pixels it has. */
function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    setWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** A round upper bound for an axis: 4, 5, 8, 10, 15, 20, 30 … */
export function niceMax(value: number): number {
  if (value <= 4) return 4;
  const step = value <= 10 ? 2 : value <= 30 ? 5 : 10;
  return Math.ceil(value / step) * step;
}

/**
 * A smooth curve through the points that never overshoots them (monotone cubic,
 * Fritsch–Carlson): a count that goes 12, 12, 9 does not dip below 9 on the way.
 */
export function monotonePath(points: ReadonlyArray<readonly [number, number]>): string {
  const n = points.length;
  if (n === 0) return '';
  const [x0, y0] = points[0]!;
  if (n === 1) return `M${x0},${y0}`;
  const dx = points.slice(1).map((p, i) => p[0] - points[i]![0]);
  const d = points.slice(1).map((p, i) => (p[1] - points[i]![1]) / dx[i]!);
  const m = points.map((_, i) => (i === 0 ? d[0]! : i === n - 1 ? d[n - 2]! : d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2));
  for (let i = 0; i < n - 1; i += 1) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i]!;
      m[i + 1] = t * b * d[i]!;
    }
  }
  let path = `M${x0},${y0}`;
  for (let i = 0; i < n - 1; i += 1) {
    const [xa, ya] = points[i]!;
    const [xb, yb] = points[i + 1]!;
    const h = (xb - xa) / 3;
    path += `C${xa + h},${ya + m[i]! * h} ${xb - h},${yb - m[i + 1]! * h} ${xb},${yb}`;
  }
  return path;
}

/** A column with a rounded data end and a square foot. */
function columnPath(x: number, y: number, w: number, h: number, r = 2): string {
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${y + radius}V${y + h}Z`;
}

export function ChartCard({
  title,
  note,
  legend,
  children,
}: {
  title: string;
  note?: string;
  legend?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <figure className="min-w-0 rounded-xl border border-border bg-surface p-3">
      <figcaption className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-sm font-semibold">{title}</span>
        {note ? <span className="text-xs text-fg-muted">{note}</span> : null}
        {legend ? <span className="ml-auto flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-muted">{legend}</span> : null}
      </figcaption>
      {children}
    </figure>
  );
}

/** A series' key: the coloured mark beside its name, so identity is not colour alone. */
export function LegendKey({ color, name, total }: { color: string; name: string; total?: number }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: color }} />
      {name}
      {total !== undefined ? <span className="tabular-nums text-fg-faint">{total}</span> : null}
    </span>
  );
}

interface Tip {
  /** Pixel position inside the chart box. */
  x: number;
  y: number;
  title: string;
  rows: Array<{ color?: string; name: string; value: number }>;
}

function Tooltip({ tip, width }: { tip: Tip; width: number }): JSX.Element {
  // Flip to the left of the point near the right edge so it is never cut off.
  const left = tip.x > width * 0.6;
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 min-w-[7rem] rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-xs shadow-pop"
      style={{ left: tip.x, top: Math.max(0, tip.y - 8), transform: `translate(${left ? 'calc(-100% - 10px)' : '10px'}, -100%)` }}
    >
      <p className="mb-0.5 font-semibold">{tip.title}</p>
      {tip.rows.map((row) => (
        <p key={row.name} className="flex items-center gap-1.5 text-fg-muted">
          {row.color ? <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: row.color }} /> : null}
          <span className="flex-1">{row.name}</span>
          <span className="tabular-nums font-semibold text-fg">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

const PAD = { left: 30, right: 14, top: 14, bottom: 22 };

/** A value over time as a smooth line with a faint area; days without a value leave a gap. */
export function TrendLine({
  points,
  name,
  ariaLabel,
  height = 168,
}: {
  points: ReadonlyArray<{ label: string; value: number | null }>;
  name: string;
  ariaLabel: string;
  height?: number;
}): JSX.Element {
  const [box, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...points.map((p) => p.value ?? 0)));
  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number): number => PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number): number => PAD.top + innerH - (v / top) * innerH;

  // Runs of consecutive days that have a value: a missing day is a gap, never zero.
  const runs: Array<Array<readonly [number, number, number]>> = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      runs.push([]);
      return;
    }
    if (runs.length === 0) runs.push([]);
    runs[runs.length - 1]!.push([x(i), y(p.value), i]);
  });
  const filled = runs.filter((run) => run.length > 0);
  const last = [...points.keys()].reverse().find((i) => points[i]!.value !== null);
  const ticks = [0, top / 2, top];
  const labelAt = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);
  const tip: Tip | null =
    active !== null && points[active]?.value !== null && points[active] !== undefined
      ? { x: x(active), y: y(points[active]!.value!), title: points[active]!.label, rows: [{ name, value: points[active]!.value! }] }
      : null;

  return (
    <div ref={box} className="relative">
      {width > 0 ? (
        <svg
          role="img"
          aria-label={ariaLabel}
          width={width}
          height={height}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const at = ((event.clientX - rect.left - PAD.left) / innerW) * (points.length - 1);
            setActive(Math.min(points.length - 1, Math.max(0, Math.round(at))));
          }}
          onPointerLeave={() => setActive(null)}
          style={{ touchAction: 'pan-y' }}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
              <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={AXIS} className="tabular-nums">
                {Number.isInteger(tick) ? tick : tick.toFixed(1)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            labelAt.has(i) ? (
              <text key={p.label + i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize={11} fill={AXIS}>
                {p.label}
              </text>
            ) : null,
          )}
          {filled.map((run) => (
            <g key={run[0]![2]}>
              {run.length > 1 ? (
                <path d={`${monotonePath(run.map(([px, py]) => [px, py] as const))}L${run[run.length - 1]![0]},${y(0)}L${run[0]![0]},${y(0)}Z`} fill="var(--chart-1)" fillOpacity={0.1} />
              ) : null}
              <path d={monotonePath(run.map(([px, py]) => [px, py] as const))} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
          {last !== undefined ? (
            <g>
              <circle cx={x(last)} cy={y(points[last]!.value!)} r={5} fill="var(--chart-1)" stroke={SURFACE} strokeWidth={2} />
              <text x={x(last) - 2} y={y(points[last]!.value!) - 12} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--fg)" className="tabular-nums">
                {points[last]!.value}
              </text>
            </g>
          ) : null}
          {tip && active !== null ? (
            <g>
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--border-strong)" strokeWidth={1} />
              <circle cx={x(active)} cy={y(points[active]!.value!)} r={5} fill="var(--chart-1)" stroke={SURFACE} strokeWidth={2} />
            </g>
          ) : null}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {tip ? <Tooltip tip={tip} width={width} /> : null}
    </div>
  );
}

/**
 * Columns per day: one column per series, side by side. With a single series
 * the value sits on the cap; with several, the tooltip and the table carry them.
 */
export function Columns({
  groups,
  series,
  ariaLabel,
  height = 168,
  showValues = false,
}: {
  groups: ReadonlyArray<{ label: string; values: readonly number[] }>;
  series: ReadonlyArray<{ name: string; color: string }>;
  ariaLabel: string;
  height?: number;
  showValues?: boolean;
}): JSX.Element {
  const [box, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...groups.flatMap((g) => g.values)));
  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, groups.length);
  const gap = 2;
  const barW = Math.max(4, Math.min(24, (slot * 0.72 - gap * (series.length - 1)) / series.length));
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v: number): number => PAD.top + innerH - (v / top) * innerH;
  // A date label is ~32px: show every other one until a slot fits it.
  const every = slot < 38 ? 2 : 1;
  const tip: Tip | null =
    active !== null && groups[active]
      ? {
          x: PAD.left + slot * active + slot / 2,
          y: y(Math.max(...groups[active]!.values)),
          title: groups[active]!.label,
          rows: series.map((s, i) => ({ color: s.color, name: s.name, value: groups[active]!.values[i] ?? 0 })),
        }
      : null;

  return (
    <div ref={box} className="relative">
      {width > 0 ? (
        <svg
          role="img"
          aria-label={ariaLabel}
          width={width}
          height={height}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setActive(Math.min(groups.length - 1, Math.max(0, Math.floor((event.clientX - rect.left - PAD.left) / slot))));
          }}
          onPointerLeave={() => setActive(null)}
          style={{ touchAction: 'pan-y' }}
        >
          {[0, top / 2, top].map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth={1} />
              <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" fontSize={11} fill={AXIS} className="tabular-nums">
                {Number.isInteger(tick) ? tick : tick.toFixed(1)}
              </text>
            </g>
          ))}
          {groups.map((group, g) => {
            const gx = PAD.left + slot * g + (slot - groupW) / 2;
            return (
              <g key={group.label + g} opacity={active === null || active === g ? 1 : 0.55}>
                {series.map((s, i) => {
                  const value = group.values[i] ?? 0;
                  if (value <= 0) return null;
                  const h = Math.max(2, y(0) - y(value));
                  const bx = gx + i * (barW + gap);
                  return (
                    <g key={s.name}>
                      <path d={columnPath(bx, y(0) - h, barW, h)} fill={s.color} />
                      {showValues && series.length === 1 ? (
                        <text x={bx + barW / 2} y={y(0) - h - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--fg)" className="tabular-nums">
                          {value}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                {g % every === 0 ? (
                  <text x={PAD.left + slot * g + slot / 2} y={height - 6} textAnchor="middle" fontSize={11} fill={AXIS}>
                    {group.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {tip ? <Tooltip tip={tip} width={width} /> : null}
    </div>
  );
}

/** Rows compared by length: a label, a bar at most 24px thick, the value at its tip. */
export function BarRows({
  rows,
  color = 'var(--accent)',
  empty,
}: {
  rows: ReadonlyArray<{ label: string; value: number }>;
  color?: string;
  empty: string;
}): JSX.Element {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="py-6 text-center text-xs text-fg-faint">{empty}</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 truncate text-fg-muted" title={row.label}>
            {row.label}
          </span>
          <span className="flex h-4 min-w-0 flex-1 items-center">
            <span className="h-3 rounded-r-[4px]" style={{ width: `${(row.value / max) * 100}%`, minWidth: 3, background: color }} />
          </span>
          <span className="w-6 shrink-0 text-right font-semibold tabular-nums">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}
