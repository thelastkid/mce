import { useState, useEffect } from "react";
import { ArrowDownRight, ArrowUpRight, LineChart, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProviderRate = {
  name: string;
  hourly_base_inr: number;
  change_24h_pct: number;
  spot_discount_pct: number;
  status: string;
};

type RealtimeData = {
  timestamp: string;
  currency: string;
  providers: Record<string, ProviderRate>;
};

export function RealtimePriceTicker({ onOpenTrends }: { onOpenTrends: () => void }) {
  const [data, setData] = useState<RealtimeData | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchRates() {
    try {
      const res = await fetch("/api/analytics/realtime-prices");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {}
  }

  useEffect(() => {
    fetchRates();
    const interval = setInterval(fetchRates, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border-b border-border bg-surface/90 px-4 py-2 sm:px-6 lg:px-8 text-xs backdrop-blur">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-semibold text-foreground">Live Cloud Ticker:</span>
          <span className="text-muted-foreground hidden sm:inline">Real-time compute cost signals</span>
        </div>

        <div className="flex items-center gap-5 overflow-x-auto py-0.5">
          {data?.providers ? (
            Object.entries(data.providers).map(([code, p]) => {
              const isDrop = p.change_24h_pct <= 0;
              const points = Array.from({ length: 7 }, (_, index) => 10 + Math.sin(index * 1.4 + p.change_24h_pct) * 2 + p.change_24h_pct * index * 0.12);
              const path = points.map((point, index) => `${index ? "L" : "M"}${index * 10},${18 - point}`).join(" ");
              return (
                <div key={code} className={`ticker-provider ${code.toLowerCase()}`}>
                  <span className="provider-dot" />
                  <span className="font-bold text-foreground">{code}</span>
                  <svg className="ticker-sparkline" viewBox="0 0 60 20" aria-hidden="true"><path d={path} /></svg>
                  <span className="font-mono text-foreground font-semibold">
                    ₹{p.hourly_base_inr.toFixed(2)}/hr
                  </span>
                  <span
                    className={`trend-chip ${isDrop ? "drop" : "rise"}`}
                  >
                    {isDrop ? (
                      <ArrowDownRight className="size-3" />
                    ) : (
                      <ArrowUpRight className="size-3" />
                    )}
                    {Math.abs(p.change_24h_pct)}%
                  </span>
                </div>
              );
            })
          ) : (
            <span className="text-muted-foreground flex items-center gap-1">
              <RefreshCw className="size-3 animate-spin text-primary" /> Syncing live market rates…
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenTrends}
          className="h-7 text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
        >
          <LineChart className="size-3.5" />
          Price Trends & Forecast Popup ↗
        </Button>
      </div>
    </div>
  );
}

