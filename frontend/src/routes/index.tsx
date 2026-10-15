import { createFileRoute } from "@tanstack/react-router";
import {
  Cloud,
  Cpu,
  Database,
  Gauge,
  HardDrive,
  Minus,
  Plus,
  Calculator,
  Sprout,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { DecisionCenter, type DeployResult } from "@/components/decision-center";
import { Button } from "@/components/ui/button";
import { deployWorkload } from "@/lib/deployment";
import { DocumentAnalyzer, type DocumentAnalysis } from "@/components/document-analyzer";
import { PlantDiseaseModal } from "@/components/plant-disease-modal";
import { PriceTrendsModal } from "@/components/price-trends-modal";
import { RealtimePriceTicker } from "@/components/realtime-price-ticker";
import { CloudNetworkCanvas } from "@/components/cloud-network-canvas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Multi-Cloud Infrastructure Optimizer & MLOps Control Plane" },
      {
        name: "description",
        content:
          "Estimate and optimize MLOps workloads across AWS, Azure, and GCP using real-time resource and pricing signals.",
      },
      { property: "og:title", content: "Multi-Cloud Infrastructure Optimizer" },
      {
        property: "og:description",
        content:
          "Estimate and optimize MLOps workloads across AWS, Azure, and GCP using real-time resource and pricing signals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const defaultRecommended = { cpu: 8, memory: 32 };

function Index() {
  const [application, setApplication] = useState("plant-api");
  const [cpu, setCpu] = useState(defaultRecommended.cpu);
  const [memory, setMemory] = useState(defaultRecommended.memory);
  const [gpu, setGpu] = useState(false);
  const [priority, setPriority] = useState("medium");
  const [region, setRegion] = useState("India");
  const [result, setResult] = useState<DeployResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlantModal, setShowPlantModal] = useState(false);
  const [showTrendsModal, setShowTrendsModal] = useState(false);
  const [documentAnalysis, setDocumentAnalysis] = useState<DocumentAnalysis | null>(null);

  async function estimatePlacement() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await deployWorkload({
        data: {
          application,
          cpu,
          memory,
          gpu,
          region: region as "India" | "US" | "Europe",
          priority: priority as "low" | "medium" | "high",
        },
      });
      setResult(data as DeployResult);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The estimator service could not be reached. Please verify backend is running on port 8000.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Apply document recommendations as editable defaults for the resource controls.
  function handleAnalysisComplete(analysis: DocumentAnalysis) {
    setDocumentAnalysis(analysis);
    setApplication(analysis.filename);
    const rec = analysis.recommended_resources;
    setCpu(rec.cpu);
    setMemory(rec.memory);
    setGpu(rec.gpu);
    setPriority(rec.priority);
    setRegion(rec.region);
  }

  return (
    <main className="app-shell min-h-screen bg-background text-foreground">
      <CloudNetworkCanvas />
      {/* Header */}
      <header className="app-header border-b border-border bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {/* Cloud Icon (Replacing previous Star/Sparkles symbol) */}
            <span className="brand-mark grid size-9 place-items-center rounded-md">
              <Cloud className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Multi-Cloud Optimizer</p>
              <p className="text-xs text-muted-foreground">MLOps Infrastructure Control Plane</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {application === "plant-api" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPlantModal(true)}
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs gap-1.5"
              >
                <Sprout className="size-3.5" />
                Test Plant Disease Model
              </Button>
            )}
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span className="size-1.5 rounded-full bg-success" />
              Engine operational
            </div>
          </div>
        </div>
      </header>

      {/* Real-Time Price Ticker Bar */}
      <RealtimePriceTicker onOpenTrends={() => setShowTrendsModal(true)} />

      <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 max-w-3xl">
          <p className="eyebrow">Multi-cloud infrastructure</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground sm:text-4xl">
            Place every ML workload <span className="hero-gradient">with confidence.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Upload any workload file or select an application. Scan requirements, monitor real-time cloud prices, and estimate placement across AWS, Azure, and GCP.
          </p>
        </div>

        {/* Document analysis summary */}
        {documentAnalysis && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-primary/20 text-primary">
                <CheckCircle2 className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Analyzed Architecture: {documentAnalysis.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {documentAnalysis.summary} Resources auto-adjusted below (you can still modify them freely).
                </p>
              </div>
            </div>
            <div className="text-xs font-mono bg-secondary/80 px-3 py-1.5 rounded-lg border border-border">
              {cpu} vCPU • {memory} GB • {gpu ? "GPU Enabled" : "CPU Only"}
            </div>
          </div>
        )}

        <div className="dashboard-grid items-start gap-4">
          {/* 01 Architecture document upload */}
          <DocumentAnalyzer
            onAnalysisComplete={handleAnalysisComplete}
            onAnalysisReset={() => {
              setDocumentAnalysis(null);
              setApplication("plant-api");
            }}
          />

          {/* 02 Resource Configuration (Fully editable) */}
          <section className="panel p-5 sm:p-6" aria-labelledby="resources-title">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="eyebrow">02 / Resources</p>
                <h2 id="resources-title" className="mt-1 text-lg font-semibold text-foreground">
                  Recommendation & control
                </h2>
              </div>
              <Gauge className="size-5 text-primary" />
            </div>

            <div className="demo-callout">
              <span className="demo-badge">Active sizing</span>
              <p>
                Current recommendation:{" "}
                <strong>
                  {cpu} CPU / {memory} GB {gpu ? "• GPU" : ""}
                </strong>
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <Stepper
                icon={Cpu}
                label="CPU cores"
                value={cpu}
                min={1}
                max={64}
                recommendedValue={cpu}
                onChange={setCpu}
              />
              <Stepper
                icon={Database}
                label="Memory"
                unit="GB"
                value={memory}
                min={2}
                max={256}
                recommendedValue={memory}
                onChange={setMemory}
              />
            </div>

            <div className="my-5 h-px bg-border" />
            <div className="space-y-4">
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <span>
                  <span className="block text-sm font-medium text-foreground">GPU required</span>
                  <span className="text-xs text-muted-foreground">
                    Enable hardware tensor accelerator
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={gpu}
                  checked={gpu}
                  onChange={(event) => setGpu(event.target.checked)}
                  className="switch"
                />
              </label>

              <Control label="Priority">
                <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                  <option value="low">Low (Spot / Preemptible)</option>
                  <option value="medium">Medium (Standard On-Demand)</option>
                  <option value="high">High (Multi-AZ Reserved)</option>
                </select>
              </Control>

              <Control label="Deployment region">
                <select value={region} onChange={(event) => setRegion(event.target.value)}>
                  <option value="India">India (Mumbai / Pune)</option>
                  <option value="US">United States (Virginia / Iowa)</option>
                  <option value="Europe">Europe (Frankfurt / Amsterdam)</option>
                </select>
              </Control>
            </div>

            <Button
              type="button"
              size="lg"
              onClick={estimatePlacement}
              disabled={loading || !application}
              className="estimate-button mt-6 w-full text-sm font-semibold"
            >
              <Calculator className="size-4" />
              {loading ? "Estimating..." : "Estimate placement"}
            </Button>

          </section>

          {/* 03 Decision Center */}
          <DecisionCenter
            result={result}
            loading={loading}
            error={error}
            onOpenTrends={() => setShowTrendsModal(true)}
            documentAnalysis={documentAnalysis}
          />
        </div>
      </div>

      {/* Popups */}
      <PriceTrendsModal
        isOpen={showTrendsModal}
        onClose={() => setShowTrendsModal(false)}
        initialCpu={cpu}
        initialMemory={memory}
        initialGpu={gpu}
        initialRegion={region}
        initialPriority={priority}
      />
      <PlantDiseaseModal isOpen={showPlantModal} onClose={() => setShowPlantModal(false)} />
    </main>
  );
}

function Stepper({
  icon: Icon,
  label,
  unit,
  value,
  min,
  max,
  recommendedValue,
  onChange,
}: {
  icon: typeof HardDrive;
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  recommendedValue: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="resource-control">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
            {value === recommendedValue ? "Recommended" : "Configured"} {recommendedValue}
            {unit ? ` ${unit}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="size-3.5" />
        </Button>
        <div className="selected-value">
          <strong>{value}</strong>
          <span>{unit ?? "cores"}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          aria-label={`Increase ${label}`}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="control-row">
      <span>{label}</span>
      {children}
    </label>
  );
}
