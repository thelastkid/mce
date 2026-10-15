import {
  Check,
  CircleDollarSign,
  Cloud,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
  LineChart,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DocComponent, DocumentAnalysis } from "@/components/document-analyzer";

type CostEstimate = {
  estimated_cost: number;
  hourly_usd?: number;
  monthly_usd?: number;
  monthly_inr?: number;
  instance_type?: string;
  specs?: Record<string, unknown>;
};

export type DeployResult = {
  status?: string;
  selected_cloud?: string;
  reason?: string;
  cost_estimates?: Record<string, CostEstimate>;
  detailed_breakdown?: Record<string, unknown>;
};

type DecisionCenterProps = {
  result: DeployResult | null;
  loading: boolean;
  error: string | null;
  onOpenTrends?: () => void;
  documentAnalysis?: DocumentAnalysis | null;
};

const providerUrls: Record<string, string> = {
  aws: "https://console.aws.amazon.com/billing/home#/",
  azure: "https://portal.azure.com/#view/Microsoft_Azure_Billing/SubscriptionsBlade",
  gcp: "https://console.cloud.google.com/billing",
};

const cloudBadge: Record<string, string> = {
  AWS: "provider-badge aws provider-text aws",
  Azure: "provider-badge azure provider-text azure",
  GCP: "provider-badge gcp provider-text gcp",
};

function normalizeProvider(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("amazon")) return "aws";
  if (lower.includes("google")) return "gcp";
  return lower;
}

export function DecisionCenter({ result, loading, error, onOpenTrends, documentAnalysis }: DecisionCenterProps) {
  return (
    <section className="panel overflow-hidden" aria-labelledby="decision-title">
      <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
        <div>
          <p className="eyebrow">03 / Decision center</p>
          <h2 id="decision-title" className="mt-1 text-lg font-semibold text-foreground">
            Cloud placement analysis
          </h2>
        </div>
        <span className="status-dot"><span />Live engine</span>
      </header>

      <div className="p-5 sm:p-6">
        {loading && <LoadingState />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && !error && !result && <EmptyState hasDoc={!!documentAnalysis?.components?.length} />}
        {!loading && !error && result && (
          <ResultState result={result} documentAnalysis={documentAnalysis} />
        )}

        <div className="mt-5 border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={onOpenTrends}
            className="w-full justify-between h-auto py-2.5 px-3.5 text-xs bg-secondary/30 hover:bg-secondary/60 border-border"
          >
            <span className="flex items-center gap-2 text-foreground font-semibold">
              <LineChart className="size-4 text-primary" />
              Cloud Price Trends &amp; Interactive Simulator
            </span>
            <span className="text-[11px] text-primary flex items-center gap-1 font-mono">
              Open Popup ↗
            </span>
          </Button>
        </div>
      </div>
    </section>
  );
}

function EmptyState({ hasDoc }: { hasDoc: boolean }) {
  return (
    <div className="state-box">
      <Cloud className="size-8 text-primary" />
      <h3>Ready to estimate</h3>
      <p>
        {hasDoc
          ? "Architecture document analyzed ✓ — press Estimate to get multi-cloud placement and per-component pricing breakdown."
          : "Upload an architecture PDF or configure resources manually, then press Estimate to compare placement across AWS, Azure, and GCP."}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="state-box">
      <LoaderCircle className="size-8 animate-spin text-primary" />
      <h3>Evaluating cloud options</h3>
      <p>Applying policy and comparing current provider estimates…</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="state-box border-destructive/40 bg-destructive/5">
      <TriangleAlert className="size-8 text-destructive" />
      <h3>Estimation failed</h3>
      <p>{message}</p>
    </div>
  );
}

function TrendBadge({ trend }: { trend: "flat" | "decreasing" | "increasing" }) {
  if (trend === "decreasing")
    return <span className="flex items-center gap-0.5 text-emerald-400 text-[9px] font-semibold"><TrendingDown className="size-3" />Dropping</span>;
  if (trend === "increasing")
    return <span className="flex items-center gap-0.5 text-rose-400 text-[9px] font-semibold"><TrendingUp className="size-3" />Rising</span>;
  return <span className="flex items-center gap-0.5 text-slate-400 text-[9px] font-semibold"><Minus className="size-3" />Stable</span>;
}

function ComponentBreakdown({ components }: { components: DocComponent[] }) {
  return (
    <div className="mt-5">
      <p className="eyebrow mb-2">Per-component cloud allocation</p>
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {components.map((comp) => (
          <div
            key={comp.id}
            className="flex items-start gap-2 rounded-lg border border-border bg-secondary/20 px-2.5 py-2"
          >
            <span className="text-base leading-none mt-0.5">{comp.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="text-[11px] font-semibold text-foreground">{comp.name}</span>
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-semibold shrink-0", cloudBadge[comp.recommended_cloud] ?? "bg-secondary")}>
                  {comp.recommended_cloud}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5 gap-1 flex-wrap">
                <span className="text-[10px] text-muted-foreground">
                  {comp.recommended_cloud === "AWS" ? comp.aws_service : comp.recommended_cloud === "Azure" ? comp.azure_service : comp.gcp_service}
                </span>
                <TrendBadge trend={comp.price_trend} />
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-muted-foreground">Monthly:</span>
                <span className="text-[10px] font-mono font-semibold text-foreground">
                  ₹{comp.monthly_inr_low.toLocaleString()} – ₹{comp.monthly_inr_high.toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground" title={comp.price_trend_note}>
                {comp.price_stable ? "Price outlook: stable" : `Price outlook: ${comp.price_trend_note}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultState({ result, documentAnalysis }: { result: DeployResult; documentAnalysis?: DocumentAnalysis | null }) {
  const provider = result.selected_cloud ?? "Unknown";
  const providerKey = normalizeProvider(provider);
  const url = providerUrls[providerKey];
  const estimates = result.cost_estimates ?? {};
  const hasComponents = (documentAnalysis?.components?.length ?? 0) > 0;
  const providerCosts = ["AWS", "Azure", "GCP"].map((name) => {
    const entry = Object.entries(estimates).find(([key]) => normalizeProvider(key) === name.toLowerCase());
    return { name, cost: entry?.[1]?.estimated_cost ?? 0, monthly: entry?.[1]?.monthly_inr ?? 0 };
  });
  const highestCost = Math.max(...providerCosts.map(({ cost }) => cost), 1);
  const cheapestCost = Math.min(...providerCosts.filter(({ cost }) => cost > 0).map(({ cost }) => cost), Infinity);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="status-success">
          <Check className="size-3" />
          {result.status ?? "Completed"}
        </span>
        <span className="text-xs text-muted-foreground">Placement Result</span>
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="recommendation-card group">
          <span className="eyebrow">Recommended cloud</span>
          <span className="mt-3 flex items-center justify-between">
            <strong className="text-3xl font-semibold capitalize text-foreground">
              {provider}
            </strong>
            <ExternalLink className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
          </span>
          <span className="mt-3 block text-sm leading-6 text-muted-foreground">
            {result.reason ?? "Selected from the available cost and policy signals."}
          </span>
        </a>
      ) : (
        <div className="recommendation-card">
          <span className="eyebrow">Recommended cloud</span>
          <strong className="mt-3 block text-3xl text-foreground">{provider}</strong>
          <span className="mt-3 block text-sm text-muted-foreground">{result.reason}</span>
        </div>
      )}

      <div className="result-grid">
        {providerCosts.map(({ name, cost, monthly }) => {
          const selected = normalizeProvider(provider) === name.toLowerCase();
          const isCheapest = cost > 0 && cost === cheapestCost;
          return (
            <div key={name} className={cn("provider-result-card", name.toLowerCase(), selected && "selected")}>
              <div className="flex items-center justify-between gap-2">
                <span className="provider-name"><span className="provider-dot" />{name}</span>
                {isCheapest && <span className="best-match">Best match</span>}
              </div>
              <strong>{formatCost(cost)}/hr</strong>
              <small>₹{Math.round(monthly).toLocaleString()}/mo</small>
              <div className="cost-bar" aria-label={`${name} relative cost`}><span style={{ width: `${Math.max(8, (cost / highestCost) * 100)}%` }} /></div>
              {selected && <em>Selected by engine</em>}
            </div>
          );
        })}
      </div>

      {/* Per-component breakdown (only when document was analyzed) */}
      {hasComponents && <ComponentBreakdown components={documentAnalysis!.components} />}

      <div className="mt-5">
        <p className="eyebrow mb-3">Decision trail</p>
        <div className="trail">
          <TrailItem icon={ShieldCheck} label="Policy checked" />
          <TrailItem icon={CircleDollarSign} label="Cost evaluated" />
          <TrailItem icon={Cloud} label="Cloud selected" />
        </div>
      </div>
    </div>
  );
}

function TrailItem({ icon: Icon, label }: { icon: typeof Check; label: string }) {
  return (
    <div>
      <span>
        <Icon className="size-3.5" />
      </span>
      <p>{label}</p>
    </div>
  );
}

function formatCost(value: number | undefined) {
  if (value === undefined) return "—";
  return `₹${value.toFixed(2)}`;
}
