/**
 * PriceTrendsModal
 * Popup modal with:
 * 1. Live historical + current + 5-month forecast chart (existing)
 * 2. Interactive simulator: sliders for CPU / Memory / GPU toggle / Region / Priority
 *    → fetches /api/documents/interactive-cost and re-renders the chart in real-time
 */
import { useState, useEffect, useCallback } from "react";
import {
  TrendingDown,
  TrendingUp,
  X,
  Cloud,
  CheckCircle,
  RefreshCw,
  Settings2,
  Cpu,
  Database,
  BarChart3,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type PricePoint = {
  period: string;
  price: number;
  stage: "historical" | "current" | "forecast";
  lower_bound?: number;
  upper_bound?: number;
};

type TrendsData = {
  currency: string;
  unit: string;
  updated_at: string;
  series: Record<string, PricePoint[]>;
  insights: string[];
};

type InteractiveSeries = {
  hourly_inr: number;
  monthly_inr: number;
  series: PricePoint[];
};

type InteractiveData = {
  config: { cpu: number; memory: number; gpu: boolean; region: string; priority: string };
  currency: string;
  providers: Record<string, InteractiveSeries>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const providerColors: Record<string, { stroke: string; fill: string; badge: string; text: string }> = {
  AWS: { stroke: "#FF9900", fill: "rgba(255,153,0,0.15)", badge: "provider-badge aws", text: "provider-text aws" },
  Azure: { stroke: "#38BDF8", fill: "rgba(56,189,248,0.15)", badge: "provider-badge azure", text: "provider-text azure" },
  GCP: { stroke: "#A78BFA", fill: "rgba(167,139,250,0.15)", badge: "provider-badge gcp", text: "provider-text gcp" },
};

const SVG_W = 760, SVG_H = 260, PAD_X = 60, PAD_Y = 40;

// ─── Helper: SVG path ─────────────────────────────────────────────────────────

function makePath(points: PricePoint[], allPts: PricePoint[], filterStage: "historical" | "forecast" | "all", getX: (i: number) => number, getY: (p: number) => number) {
  const indexed = allPts.map((p, idx) => ({ p, idx }));
  const filtered = indexed.filter(({ p }) => {
    if (filterStage === "all") return true;
    if (filterStage === "historical") return p.stage === "historical" || p.stage === "current";
    return p.stage === "forecast" || p.stage === "current";
  });
  if (filtered.length < 2) return "";
  return filtered.map(({ p, idx }, i) => `${i === 0 ? "M" : "L"} ${getX(idx).toFixed(1)} ${getY(p.price).toFixed(1)}`).join(" ");
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PriceTrendsModal({
  isOpen,
  onClose,
  initialCpu = 8,
  initialMemory = 32,
  initialGpu = false,
  initialRegion = "India",
  initialPriority = "medium",
}: {
  isOpen: boolean;
  onClose: () => void;
  initialCpu?: number;
  initialMemory?: number;
  initialGpu?: boolean;
  initialRegion?: string;
  initialPriority?: string;
}) {
  // Tab: "trends" (historical live chart) | "simulator" (interactive)
  const [tab, setTab] = useState<"trends" | "simulator">("trends");

  // Trends tab state
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("All");
  const [hoveredPoint, setHoveredPoint] = useState<{ provider: string; point: PricePoint } | null>(null);

  // Simulator tab state
  const [simCpu, setSimCpu] = useState(initialCpu);
  const [simMemory, setSimMemory] = useState(initialMemory);
  const [simGpu, setSimGpu] = useState(initialGpu);
  const [simRegion, setSimRegion] = useState(initialRegion);
  const [simPriority, setSimPriority] = useState(initialPriority);
  const [simData, setSimData] = useState<InteractiveData | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simHoveredPoint, setSimHoveredPoint] = useState<{ provider: string; point: PricePoint } | null>(null);
  const [simSelectedProvider, setSimSelectedProvider] = useState("All");

  // Load trends data when modal opens
  useEffect(() => {
    if (isOpen && !trendsData) {
      setTrendsLoading(true);
      fetch("/api/analytics/trends")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setTrendsData(d))
        .catch(() => {})
        .finally(() => setTrendsLoading(false));
    }
  }, [isOpen]);

  // Sync initial values from estimate
  useEffect(() => {
    if (isOpen) {
      setSimCpu(initialCpu);
      setSimMemory(initialMemory);
      setSimGpu(initialGpu);
      setSimRegion(initialRegion);
      setSimPriority(initialPriority);
    }
  }, [isOpen, initialCpu, initialMemory, initialGpu, initialRegion, initialPriority]);

  // Fetch interactive cost whenever simulator params change
  const fetchSimData = useCallback(async (cpu: number, memory: number, gpu: boolean, region: string, priority: string) => {
    setSimLoading(true);
    try {
      const params = new URLSearchParams({
        cpu: String(cpu),
        memory: String(memory),
        gpu: String(gpu),
        region,
        priority,
      });
      const res = await fetch(`/api/documents/interactive-cost?${params}`);
      if (res.ok) {
        const d: InteractiveData = await res.json();
        setSimData(d);
      }
    } catch (_) {}
    setSimLoading(false);
  }, []);

  // Auto-fetch when tab switches to simulator or params change
  useEffect(() => {
    if (isOpen && tab === "simulator") {
      fetchSimData(simCpu, simMemory, simGpu, simRegion, simPriority);
    }
  }, [isOpen, tab, simCpu, simMemory, simGpu, simRegion, simPriority]);

  if (!isOpen) return null;

  const providers = ["AWS", "Azure", "GCP"];

  // ── Shared chart renderer ────────────────────────────────────────────────────
  function renderChart(
    seriesMap: Record<string, PricePoint[]>,
    hoveredPt: typeof hoveredPoint,
    setHoveredPt: (v: typeof hoveredPoint) => void,
    selProv: string,
    loading: boolean,
  ) {
    const stackedSeries: Record<string, PricePoint[]> = {};
    providers.forEach((prov, providerIndex) => {
      const points = seriesMap[prov] || [];
      stackedSeries[prov] = points.map((point, pointIndex) => ({
        ...point,
        price: providers
          .slice(0, providerIndex + 1)
          .reduce((total, provider) => total + (seriesMap[provider]?.[pointIndex]?.price ?? 0), 0),
      }));
    });

    const allPrices: number[] = [];
    Object.values(stackedSeries).forEach((pts) => pts.forEach((p) => allPrices.push(p.price)));
    const minP = allPrices.length ? Math.floor(Math.min(...allPrices) - 1) : 15;
    const maxP = allPrices.length ? Math.ceil(Math.max(...allPrices) + 1) : 40;

    const periods = stackedSeries.AWS?.map((p) => p.period) ?? [];
    const currentIdx = stackedSeries.AWS?.findIndex((p) => p.stage === "current") ?? 6;

    const getX = (idx: number) => PAD_X + (idx / Math.max(1, periods.length - 1)) * (SVG_W - 2 * PAD_X);
    const getY = (price: number) => {
      const range = maxP - minP || 1;
      return SVG_H - PAD_Y - ((price - minP) / range) * (SVG_H - 2 * PAD_Y);
    };

    return (
      <div className="price-chart relative rounded-xl border border-border bg-background p-4 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10">
            <RefreshCw className="size-5 animate-spin text-primary" />
          </div>
        )}

        {hoveredPt && (
          <div className="absolute top-4 right-4 rounded-lg border border-border bg-secondary/90 backdrop-blur px-3 py-2 text-xs shadow-lg z-20">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: providerColors[hoveredPt.provider]?.stroke }} />
              {hoveredPt.provider}: ₹{hoveredPt.point.price.toFixed(2)}/hr
            </p>
            <p className="text-[10px] text-muted-foreground">
              {hoveredPt.point.period} ({hoveredPt.point.stage.toUpperCase()})
            </p>
          </div>
        )}

        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto overflow-visible select-none">
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const p = minP + pct * (maxP - minP);
            const y = getY(p);
            return (
              <g key={i}>
                <line x1={PAD_X} y1={y} x2={SVG_W - PAD_X} y2={y} stroke="var(--border)" strokeDasharray="3 3" strokeOpacity={0.6} />
                <text x={PAD_X - 8} y={y + 4} fill="var(--muted-foreground)" fontSize="10" textAnchor="end" fontFamily="monospace">
                  ₹{p.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Current divider */}
          {currentIdx >= 0 && (
            <g>
              <line x1={getX(currentIdx)} y1={PAD_Y} x2={getX(currentIdx)} y2={SVG_H - PAD_Y}
                stroke="var(--primary)" strokeDasharray="4 4" strokeWidth="1.5" opacity={0.8} />
              <rect x={getX(currentIdx) - 38} y={PAD_Y - 22} width="76" height="18" rx="4" fill="var(--surface)" stroke="var(--primary)" strokeWidth="1" />
              <text x={getX(currentIdx)} y={PAD_Y - 10} fill="var(--primary)" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                LIVE (TODAY)
              </text>
            </g>
          )}

          {/* Provider curves */}
          {providers.map((prov) => {
            if (selProv !== "All" && selProv !== prov) return null;
            const pts = stackedSeries[prov] || [];
            const color = providerColors[prov];
            const histPath = makePath(pts, pts, "historical", getX, getY);
            const forecastPath = makePath(pts, pts, "forecast", getX, getY);
            return (
              <g key={prov}>
                <path d={histPath} fill="none" stroke={color.stroke} strokeWidth={selProv === prov ? 3.5 : 2.5} strokeLinecap="round" strokeLinejoin="round" />
                <path d={forecastPath} fill="none" stroke={color.stroke} strokeWidth={selProv === prov ? 3.5 : 2.5} strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((pt, idx) => {
                  const isCurrent = pt.stage === "current";
                  return (
                    <circle key={idx} cx={getX(idx)} cy={getY(pt.price)}
                      r={isCurrent ? 5.5 : 3.5}
                      fill={isCurrent ? "var(--surface)" : color.stroke}
                      stroke={color.stroke} strokeWidth={isCurrent ? 3 : 1.5}
                      className="cursor-pointer transition-transform hover:scale-150"
                      onMouseEnter={() => setHoveredPt({ provider: prov, point: seriesMap[prov]?.[idx] ?? pt })}
                      onMouseLeave={() => setHoveredPt(null)}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* X-axis labels */}
          {(stackedSeries.AWS ?? []).map((p, idx) => {
            if (idx % 2 !== 0 && idx !== currentIdx) return null;
            return (
              <text key={idx} x={getX(idx)} y={SVG_H - PAD_Y + 18}
                fill={idx === currentIdx ? "var(--primary)" : "var(--muted-foreground)"}
                fontWeight={idx === currentIdx ? "bold" : "normal"}
                fontSize="10" textAnchor="middle" fontFamily="sans-serif">
                {p.period.replace(" (Now)", "")}
              </text>
            );
          })}
        </svg>
      </div>
    );
  }

  // ── Simulator per-provider cards ─────────────────────────────────────────────
  function renderSimCards() {
    if (!simData) return null;
    return (
      <div className="mt-4 grid grid-cols-3 gap-3">
        {providers.map((prov) => {
          const pd = simData.providers[prov];
          const color = providerColors[prov];
          const curr = pd?.series.find((p) => p.stage === "current");
          const lastForecast = pd?.series[pd.series.length - 1];
          const changePct = curr && lastForecast
            ? (((lastForecast.price - curr.price) / curr.price) * 100).toFixed(1)
            : "0";
          return (
            <div
              key={prov}
              onClick={() => setSimSelectedProvider(simSelectedProvider === prov ? "All" : prov)}
              className={`cursor-pointer rounded-xl border p-3.5 transition-all ${simSelectedProvider === prov || simSelectedProvider === "All"
                ? "border-border bg-secondary/30 hover:border-border-strong"
                : "border-border/40 opacity-40 bg-secondary/10"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: color.stroke }} />
                  {prov}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${color.badge}`}>Simulated</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">₹{curr?.price.toFixed(2) ?? "—"}</span>
                <span className="text-xs text-muted-foreground">/hr</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">₹{pd?.monthly_inr ? Math.round(pd.monthly_inr).toLocaleString() : "—"}/mo</div>
              <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>90-day forecast:</span>
                <span className={parseFloat(changePct) < 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                  {parseFloat(changePct) < 0 ? <TrendingDown className="size-3 inline mr-0.5" /> : <TrendingUp className="size-3 inline mr-0.5" />}
                  {Math.abs(parseFloat(changePct))}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto pt-8">
      <div className="price-trends-modal relative w-full max-w-4xl rounded-2xl border border-primary/30 bg-surface/95 p-6 shadow-2xl text-foreground mb-8">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/20 text-primary border border-primary/30">
              <Cloud className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-foreground">Cloud Price Trends &amp; Simulator</h3>
                <span className="rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-[11px] font-medium text-primary">
                  Interactive
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Historical rates, live prices, and an interactive resource simulator to model cost changes.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="mt-5 flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border w-fit">
          <button
            onClick={() => setTab("trends")}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${tab === "trends" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
          >
            <BarChart3 className="size-3.5" />
            Live Price Trends
          </button>
          <button
            onClick={() => setTab("simulator")}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${tab === "simulator" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
          >
            <Settings2 className="size-3.5" />
            Resource Simulator
          </button>
        </div>

        {/* ═══════════════ TRENDS TAB ═══════════════ */}
        {tab === "trends" && (
          <div className="mt-5">
            {/* Provider filter + legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-1.5 bg-secondary/50 p-1 rounded-lg border border-border">
                {["All", "AWS", "Azure", "GCP"].map((item) => (
                  <button key={item} onClick={() => setSelectedProvider(item)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${selectedProvider === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                    {item}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground" /> Historical</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-primary ring-4 ring-primary/20" /> Live</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-primary" /> Forecast</span>
              </div>
            </div>

            {trendsData
              ? renderChart(trendsData.series, hoveredPoint, setHoveredPoint, selectedProvider, trendsLoading)
              : trendsLoading
                ? <div className="h-64 flex items-center justify-center"><RefreshCw className="size-6 animate-spin text-primary" /></div>
                : <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Could not load trends data.</div>
            }

            {/* Provider summary cards */}
            {trendsData && (
              <div className="mt-5 grid grid-cols-3 gap-3">
                {providers.map((prov) => {
                  const pts = trendsData.series?.[prov] || [];
                  const curr = pts.find((p) => p.stage === "current");
                  const first = pts[0];
                  const last = pts[pts.length - 1];
                  const histChg = curr && first ? (((curr.price - first.price) / first.price) * 100).toFixed(1) : "0";
                  const fcastChg = curr && last ? (((last.price - curr.price) / curr.price) * 100).toFixed(1) : "0";
                  const color = providerColors[prov];
                  return (
                    <div key={prov} onClick={() => setSelectedProvider(prov)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all ${selectedProvider === prov || selectedProvider === "All" ? "border-border bg-secondary/30" : "border-border/40 opacity-50 bg-secondary/10"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: color.stroke }} />{prov}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${color.badge}`}>Live</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-foreground">₹{curr?.price.toFixed(2) ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">/hr</span>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>90-day forecast:</span>
                        <span className="text-success font-semibold flex items-center">
                          <TrendingDown className="size-3 mr-0.5" />{fcastChg}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Insights */}
            {trendsData?.insights && (
              <div className="mt-5 rounded-xl border border-border bg-secondary/20 p-4">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle className="size-3.5" /> ML Predictive Pricing Insights
                </p>
                <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
                  {trendsData.insights.map((insight, idx) => <li key={idx}>{insight}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ SIMULATOR TAB ═══════════════ */}
        {tab === "simulator" && (
          <div className="mt-5">
            <p className="text-xs text-muted-foreground mb-4">
              Drag the sliders to change compute resources. The chart updates instantly to show how pricing changes across AWS, Azure, and GCP — including the 5-month forecast.
            </p>

            {/* Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {/* CPU Slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Cpu className="size-3.5 text-primary" /> CPU Cores
                  </label>
                  <span className="text-xs font-mono font-bold text-primary">{simCpu} vCPU</span>
                </div>
                <input
                  type="range" min={1} max={64} step={1} value={simCpu}
                  onChange={(e) => setSimCpu(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>1</span><span>32</span><span>64</span>
                </div>
              </div>

              {/* Memory Slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Database className="size-3.5 text-primary" /> Memory
                  </label>
                  <span className="text-xs font-mono font-bold text-primary">{simMemory} GB</span>
                </div>
                <input
                  type="range" min={2} max={256} step={2} value={simMemory}
                  onChange={(e) => setSimMemory(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>2 GB</span><span>128 GB</span><span>256 GB</span>
                </div>
              </div>
            </div>

            {/* Options row */}
            <div className="flex flex-wrap items-center gap-4 mb-5">
              {/* GPU toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox" checked={simGpu}
                  onChange={(e) => setSimGpu(e.target.checked)}
                  className="switch"
                />
                <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Zap className="size-3.5 text-primary" /> GPU Accelerator
                </span>
              </label>

              {/* Region */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Region:</span>
                <select
                  value={simRegion}
                  onChange={(e) => setSimRegion(e.target.value)}
                  className="text-xs bg-secondary border border-border rounded-md px-2 py-1 text-foreground"
                >
                  <option value="India">India</option>
                  <option value="US">United States</option>
                  <option value="Europe">Europe</option>
                </select>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Priority:</span>
                <select
                  value={simPriority}
                  onChange={(e) => setSimPriority(e.target.value)}
                  className="text-xs bg-secondary border border-border rounded-md px-2 py-1 text-foreground"
                >
                  <option value="low">Low (Spot)</option>
                  <option value="medium">Medium (On-demand)</option>
                  <option value="high">High (Reserved)</option>
                </select>
              </div>

              {/* Provider filter */}
              <div className="flex items-center gap-1 ml-auto">
                {["All", "AWS", "Azure", "GCP"].map((p) => (
                  <button key={p} onClick={() => setSimSelectedProvider(p)}
                    className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-all ${simSelectedProvider === p ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulator chart */}
            {simData
              ? renderChart(
                  Object.fromEntries(Object.entries(simData.providers).map(([k, v]) => [k, v.series])),
                  simHoveredPoint,
                  setSimHoveredPoint,
                  simSelectedProvider,
                  simLoading,
                )
              : simLoading
                ? <div className="h-64 flex items-center justify-center"><RefreshCw className="size-6 animate-spin text-primary" /></div>
                : <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading simulator…</div>
            }

            {/* Provider cards */}
            {renderSimCards()}

            <p className="text-[11px] text-muted-foreground mt-4 italic">
              * Prices are estimated using provider public rate cards (scaled to INR). Actual cloud invoices may vary by commitment tier, support plan, and data transfer costs.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
