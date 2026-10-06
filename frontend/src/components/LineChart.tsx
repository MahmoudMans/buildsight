"use client";

import { type MouseEvent, useState } from "react";

import styles from "./LineChart.module.css";

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartSeries {
  name: string;
  color: string;
  points: ChartPoint[];
  dashed?: boolean;
}

export interface ChartRef {
  y: number;
  label: string;
  color: string;
}

interface LineChartProps {
  ariaLabel: string;
  formatX: (day: number) => string;
  formatY: (value: number) => string;
  height?: number;
  refs?: ChartRef[];
  series: ChartSeries[];
  yMax?: number;
  yMin?: number;
}

const WIDTH = 800;
const PAD = { top: 14, right: 22, bottom: 32, left: 66 };

function niceStep(range: number, target: number): number {
  const rough = range / target;

  if (!Number.isFinite(rough) || rough <= 0) {
    return 1;
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const fraction = rough / magnitude;

  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;

  return nice * magnitude;
}

export function LineChart({
  ariaLabel,
  formatX,
  formatY,
  height = 300,
  refs = [],
  series,
  yMax,
  yMin,
}: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const cleaned = series.map((item) => ({
    item,
    sorted: item.points
      .filter(
        (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
      )
      .sort((a, b) => a.x - b.x),
  }));

  const xs = cleaned.flatMap(({ sorted }) => sorted.map((p) => p.x));

  const ys = [
    ...cleaned.flatMap(({ sorted }) => sorted.map((p) => p.y)),
    ...refs.map((ref) => ref.y).filter(Number.isFinite),
  ];

  if (xs.length === 0 || ys.length === 0) {
    return <div className={styles.empty}>No data to chart yet.</div>;
  }

  let xMin = Math.min(...xs);
  let xMax = Math.max(...xs);

  if (xMax - xMin < 1) {
    xMin -= 15;
    xMax += 15;
  } else {
    const pad = (xMax - xMin) * 0.02;
    xMin -= pad;
    xMax += pad;
  }

  const dataMin = Math.min(...ys);
  const dataMax = Math.max(...ys);
  const span = dataMax - dataMin || Math.abs(dataMax) || 1;

  const lo = yMin ?? dataMin - span * 0.1;
  let hi = yMax ?? dataMax + span * 0.1;

  if (hi <= lo) {
    hi = lo + 1;
  }

  const step = niceStep(hi - lo, 5);
  const ticks: number[] = [];

  for (
    let index = Math.ceil(lo / step), guard = 0;
    index * step <= hi && guard < 24;
    index += 1, guard += 1
  ) {
    ticks.push(index * step);
  }

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const sx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin)) * innerW;
  const sy = (y: number) => PAD.top + (1 - (y - lo) / (hi - lo)) * innerH;

  const xTicks = Array.from(
    { length: 5 },
    (_, index) => xMin + ((xMax - xMin) * index) / 4,
  );

  const days = Array.from(new Set(xs)).sort((a, b) => a - b);

  function onMove(event: MouseEvent<SVGRectElement>) {
    const svg = event.currentTarget.ownerSVGElement;

    if (!svg) {
      return;
    }

    const box = svg.getBoundingClientRect();

    if (box.width === 0) {
      return;
    }

    const px = ((event.clientX - box.left) / box.width) * WIDTH;
    const day = xMin + ((px - PAD.left) / innerW) * (xMax - xMin);

    let best = days[0] ?? 0;

    for (const candidate of days) {
      if (Math.abs(candidate - day) < Math.abs(best - day)) {
        best = candidate;
      }
    }

    setHover(best);
  }

  return (
    <div className={styles.wrap}>
      <ul className={styles.legend}>
        {series.map((item) => (
          <li key={item.name}>
            <i
              className={item.dashed ? styles.swatchDash : styles.swatch}
              style={
                item.dashed
                  ? { borderTopColor: item.color }
                  : { background: item.color }
              }
            />
            {item.name}
          </li>
        ))}

        {refs.map((ref) => (
          <li key={ref.label}>
            <i
              className={styles.swatchDash}
              style={{ borderTopColor: ref.color }}
            />
            {ref.label}
          </li>
        ))}
      </ul>

      <div className={styles.plot}>
        <svg
          aria-label={ariaLabel}
          className={styles.svg}
          role="img"
          viewBox={`0 0 ${WIDTH} ${height}`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className={styles.grid}
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={sy(tick)}
                y2={sy(tick)}
              />

              <text
                className={styles.tick}
                textAnchor="end"
                x={PAD.left - 8}
                y={sy(tick) + 4}
              >
                {formatY(tick)}
              </text>
            </g>
          ))}

          <line
            className={styles.axis}
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={PAD.top + innerH}
            y2={PAD.top + innerH}
          />

          {xTicks.map((tick, index) => (
            <text
              className={styles.tick}
              key={index}
              textAnchor={
                index === 0 ? "start" : index === 4 ? "end" : "middle"
              }
              x={sx(tick)}
              y={height - 10}
            >
              {formatX(Math.round(tick))}
            </text>
          ))}

          {refs.map((ref) =>
            Number.isFinite(ref.y) ? (
              <g key={ref.label}>
                <line
                  stroke={ref.color}
                  strokeDasharray="5 4"
                  strokeWidth="1.3"
                  x1={PAD.left}
                  x2={WIDTH - PAD.right}
                  y1={sy(ref.y)}
                  y2={sy(ref.y)}
                />

                <text
                  className={styles.refLabel}
                  fill={ref.color}
                  textAnchor="end"
                  x={WIDTH - PAD.right - 4}
                  y={sy(ref.y) - 5}
                >
                  {ref.label}
                </text>
              </g>
            ) : null,
          )}

          {hover !== null && (
            <line
              className={styles.crosshair}
              x1={sx(hover)}
              x2={sx(hover)}
              y1={PAD.top}
              y2={PAD.top + innerH}
            />
          )}

          {cleaned.map(({ item, sorted }) => (
            <g key={item.name}>
              {sorted.length > 1 && (
                <path
                  d={sorted
                    .map(
                      (point, index) =>
                        `${index === 0 ? "M" : "L"} ${sx(point.x).toFixed(
                          1,
                        )} ${sy(point.y).toFixed(1)}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke={item.color}
                  strokeDasharray={item.dashed ? "6 4" : undefined}
                  strokeLinejoin="round"
                  strokeWidth="2.2"
                />
              )}

              {sorted.length <= 60 &&
                sorted.map((point) => (
                  <circle
                    cx={sx(point.x)}
                    cy={sy(point.y)}
                    fill="#ffffff"
                    key={point.x}
                    r={hover === point.x ? 5 : 3.2}
                    stroke={item.color}
                    strokeWidth="2"
                  />
                ))}
            </g>
          ))}

          <rect
            fill="transparent"
            height={innerH}
            onMouseLeave={() => setHover(null)}
            onMouseMove={onMove}
            width={innerW}
            x={PAD.left}
            y={PAD.top}
          />
        </svg>

        {hover !== null && (
          <div
            className={styles.tip}
            style={{
              left: `${Math.min(
                86,
                Math.max(14, (sx(hover) / WIDTH) * 100),
              )}%`,
            }}
          >
            <strong>{formatX(hover)}</strong>

            {cleaned.map(({ item, sorted }) => {
              const point = sorted.find((candidate) => candidate.x === hover);

              return (
                <div className={styles.tipRow} key={item.name}>
                  <span>
                    <i style={{ background: item.color }} />
                    {item.name}
                  </span>

                  <b>{point ? formatY(point.y) : "—"}</b>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
