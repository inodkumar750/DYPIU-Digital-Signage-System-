import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

export interface PerformancePoint {
  date?: string;
  label: string;
  activeScreens: number;
  impressions: number;
  syncRate: number;
}

type MetricKey = 'impressions' | 'activeScreens' | 'syncRate';

interface MetricConfig {
  key: MetricKey;
  label: string;
  stroke: string;
  gradientTop: string;
  formatTick: (v: number) => string;
  formatValue: (v: number) => string;
  summaryMode: 'sum' | 'avg';
}

const METRICS: MetricConfig[] = [
  {
    key: 'impressions',
    label: 'Playback cycles',
    stroke: '#500071',
    gradientTop: '#8A2A78',
    formatTick: (v) => (v === 0 ? '0' : `${Math.round(v / 1000)}k`),
    formatValue: (v) => v.toLocaleString(),
    summaryMode: 'sum',
  },
  {
    key: 'activeScreens',
    label: 'Active screens',
    stroke: '#8A2A78',
    gradientTop: '#500071',
    formatTick: (v) => `${Math.round(v)}`,
    formatValue: (v) => `${v} displays`,
    summaryMode: 'avg',
  },
  {
    key: 'syncRate',
    label: 'Sync rate',
    stroke: '#290044',
    gradientTop: '#8A2A78',
    formatTick: (v) => `${Math.round(v)}%`,
    formatValue: (v) => `${v}%`,
    summaryMode: 'avg',
  },
];

export const CampaignPerformanceChart: React.FC<{ data: PerformancePoint[] }> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const linePathRef = useRef<SVGPathElement>(null);
  const areaPathRef = useRef<SVGPathElement>(null);

  const [containerWidth, setContainerWidth] = useState(680);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('impressions');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Measure container responsively
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setContainerWidth(w);
    };
    updateWidth();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(Math.round(entry.contentRect.width));
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const metric = METRICS.find((m) => m.key === selectedMetric) || METRICS[0];

  const height = 264;
  const margin = { top: 20, right: 20, bottom: 34, left: 48 };
  const innerWidth = Math.max(240, containerWidth - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;

  // D3 scales & generators
  const { xScale, yScale, yTicks, points, lineD, areaD, summary } = useMemo(() => {
    const x = d3
      .scalePoint<string>()
      .domain(data.map((d) => d.label))
      .range([0, innerWidth])
      .padding(0.15);

    const values = data.map((d) => d[selectedMetric]);
    const minVal = d3.min(values) ?? 0;
    const maxVal = d3.max(values) ?? 100;

    let domainMin = 0;
    let domainMax = maxVal * 1.12;
    if (selectedMetric === 'syncRate') {
      domainMin = Math.max(80, Math.floor((minVal - 4) / 2) * 2);
      domainMax = 100;
    } else if (selectedMetric === 'activeScreens') {
      domainMin = 0;
      domainMax = Math.max(24, Math.ceil(maxVal * 1.15));
    }

    const y = d3.scaleLinear().domain([domainMin, domainMax]).nice(4).range([innerHeight, 0]);
    const ticks = y.ticks(4);

    const pts = data.map((d, idx) => ({
      ...d,
      idx,
      xPos: x(d.label) ?? 0,
      yPos: y(d[selectedMetric]),
      val: d[selectedMetric],
    }));

    const lineGen = d3
      .line<(typeof pts)[number]>()
      .x((d) => d.xPos)
      .y((d) => d.yPos)
      .curve(d3.curveMonotoneX);

    const areaGen = d3
      .area<(typeof pts)[number]>()
      .x((d) => d.xPos)
      .y0(innerHeight)
      .y1((d) => d.yPos)
      .curve(d3.curveMonotoneX);

    const total = d3.sum(values);
    const avg = d3.mean(values) ?? 0;
    const peakPoint = pts.reduce((best, cur) => (cur.val > best.val ? cur : best), pts[0]);

    return {
      xScale: x,
      yScale: y,
      yTicks: ticks,
      points: pts,
      lineD: lineGen(pts) || '',
      areaD: areaGen(pts) || '',
      summary: { total, avg, peakPoint },
    };
  }, [data, innerWidth, innerHeight, selectedMetric]);

  // Smooth D3 transition on metric switch or data change
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (linePathRef.current) {
      const sel = d3.select(linePathRef.current);
      if (prefersReduced) {
        sel.attr('d', lineD);
      } else {
        sel.transition().duration(320).ease(d3.easeCubicOut).attr('d', lineD);
      }
    }
    if (areaPathRef.current) {
      const sel = d3.select(areaPathRef.current);
      if (prefersReduced) {
        sel.attr('d', areaD);
      } else {
        sel.transition().duration(320).ease(d3.easeCubicOut).attr('d', areaD);
      }
    }
  }, [lineD, areaD]);

  // Pointer scrubbing across D3 scale
  const handlePointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;

    // Nearest index by X distance
    let nearest = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].xPos - relX);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = i;
      }
    }
    setHoveredIdx(nearest);
  };

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;
  // Determine visible X-axis labels so 14 days never crowd on smaller screens
  const labelStride = containerWidth < 480 ? 3 : containerWidth < 680 ? 2 : 2;
  const xStep = xScale.step();

  return (
    <div className="space-y-4">
      {/* Metric Switcher & 14-day Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Select performance metric"
          className="inline-flex items-center p-1 rounded-lg bg-[#FAF8FC] border border-[#E6E0EC] self-start"
        >
          {METRICS.map((m) => {
            const active = selectedMetric === m.key;
            return (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedMetric(m.key)}
                className={`px-3 py-1.5 rounded-md text-[13px] font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#500071] text-white shadow-xs'
                    : 'text-[#645573] hover:text-[#290044]'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#645573] font-mono tabular-nums">
          <span>
            {metric.summaryMode === 'sum' ? '14d total:' : '14d avg:'}{' '}
            <strong className="text-[#290044] font-semibold">
              {metric.summaryMode === 'sum'
                ? metric.formatValue(summary.total)
                : metric.formatValue(Math.round(summary.avg))}
            </strong>
          </span>
          {summary.peakPoint && (
            <span>
              Peak:{' '}
              <strong className="text-[#500071] font-semibold">
                {metric.formatValue(summary.peakPoint.val)} ({summary.peakPoint.label})
              </strong>
            </span>
          )}
        </div>
      </div>

      {/* Responsive D3 SVG Canvas */}
      <div ref={containerRef} className="relative w-full select-none">
        <svg
          width={containerWidth}
          height={height}
          viewBox={`0 0 ${containerWidth} ${height}`}
          className="overflow-visible block"
          role="img"
          aria-label={`D3 trend-line chart of ${metric.label} over the last 14 days`}
        >
          <defs>
            <linearGradient id="d3CampusAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metric.gradientTop} stopOpacity="0.22" />
              <stop offset="100%" stopColor={metric.gradientTop} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Horizontal Y-Axis Grid & Ticks */}
            {yTicks.map((tick) => {
              const yPos = yScale(tick);
              return (
                <g key={tick}>
                  <line
                    x1={0}
                    y1={yPos}
                    x2={innerWidth}
                    y2={yPos}
                    stroke="#E6E0EC"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={-10}
                    y={yPos + 4}
                    textAnchor="end"
                    className="fill-[#645573] text-[12px] font-mono tabular-nums"
                  >
                    {metric.formatTick(tick)}
                  </text>
                </g>
              );
            })}

            {/* Baseline X-axis */}
            <line
              x1={0}
              y1={innerHeight}
              x2={innerWidth}
              y2={innerHeight}
              stroke="#E6E0EC"
            />

            {/* D3 Area & Trend Line */}
            <path
              ref={areaPathRef}
              d={areaD}
              fill="url(#d3CampusAreaGrad)"
            />
            <path
              ref={linePathRef}
              d={lineD}
              fill="none"
              stroke={metric.stroke}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Vertical Crosshair Guideline */}
            {activePoint && (
              <line
                x1={activePoint.xPos}
                y1={0}
                x2={activePoint.xPos}
                y2={innerHeight}
                stroke="#8A2A78"
                strokeWidth={1.25}
                strokeDasharray="3 3"
              />
            )}

            {/* Data Nodes & X-Axis Labels */}
            {points.map((pt, idx) => {
              const isActive = hoveredIdx === idx;
              const showLabel =
                idx === 0 || idx === points.length - 1 || idx % labelStride === 0;

              return (
                <g key={pt.label}>
                  <circle
                    cx={pt.xPos}
                    cy={pt.yPos}
                    r={isActive ? 6 : 3.5}
                    fill={isActive ? '#EEE3B0' : '#FFFFFF'}
                    stroke={metric.stroke}
                    strokeWidth={isActive ? 2.5 : 2}
                    className="transition-all duration-100"
                  />
                  {showLabel && (
                    <text
                      x={pt.xPos}
                      y={innerHeight + 22}
                      textAnchor="middle"
                      className={`text-[12px] font-mono ${
                        isActive ? 'fill-[#290044] font-semibold' : 'fill-[#645573]'
                      }`}
                    >
                      {pt.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Interactive Scrubbing Overlay */}
            <rect
              x={-xStep * 0.25}
              y={0}
              width={innerWidth + xStep * 0.5}
              height={innerHeight + margin.bottom}
              fill="transparent"
              className="cursor-crosshair"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoveredIdx(null)}
            />
          </g>
        </svg>

        {/* Floating Branded Tooltip */}
        {activePoint && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-lg bg-[#290044] text-white border border-[#8A2A78] px-3.5 py-2.5 shadow-lg text-[12px] min-w-[180px]"
            style={{
              left: `${Math.min(
                Math.max(activePoint.xPos + margin.left - 90, 8),
                Math.max(8, containerWidth - 196)
              )}px`,
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-1.5 mb-1.5">
              <span className="font-semibold text-[#EEE3B0]">{activePoint.label}</span>
              <span className="font-mono text-white/75 text-[11px]">
                {activePoint.date || '2026'}
              </span>
            </div>
            <div className="space-y-1 font-mono tabular-nums">
              <div className="flex justify-between gap-4">
                <span className="text-white/75">Playback cycles</span>
                <span className="font-semibold text-white">
                  {activePoint.impressions.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/75">Active screens</span>
                <span className="font-semibold text-white">
                  {activePoint.activeScreens} / 24
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-white/75">Sync rate</span>
                <span className="font-semibold text-[#EEE3B0]">{activePoint.syncRate}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface BarDatum {
  label: string;
  value: number;
  total?: number;
  tone?: 'primary' | 'secondary' | 'accent' | 'cream';
}

export const HorizontalBarChart: React.FC<{ items: BarDatum[]; unit?: string }> = ({
  items,
  unit = '',
}) => {
  const maxVal = Math.max(...items.map((i) => i.total || i.value), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const pct = Math.min(100, Math.round((item.value / maxVal) * 100));
        const fill =
          item.tone === 'accent'
            ? 'bg-[#8A2A78]'
            : item.tone === 'cream'
              ? 'bg-[#c5b052]'
              : item.tone === 'primary'
                ? 'bg-[#290044]'
                : 'bg-[#500071]';

        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className="font-medium text-[#290044]">{item.label}</span>
              <span className="font-mono tabular-nums text-[#645573] shrink-0">
                {item.value}
                {item.total ? ` / ${item.total}` : ''}
                {unit}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#F1ECF6] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${fill}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
