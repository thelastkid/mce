/**
 * DocumentAnalyzer
 * Accepts a PDF / Word doc / Markdown / text file describing a project's architecture or tech stack.
 * Calls /api/documents/analyze → returns detected components with per-component cloud service + cost breakdown.
 * Emits onAnalysisComplete with recommended resources so Box 02 updates automatically.
 */

import {
  FileUp, FileText, X, LoaderCircle, CheckCircle2, AlertTriangle,
  FileCode2, Sparkles,
} from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocComponent = {
  id: string;
  name: string;
  icon: string;
  category: string;
  recommended_cloud: string;
  aws_service: string;
  azure_service: string;
  gcp_service: string;
  monthly_cost_usd_low: number;
  monthly_cost_usd_high: number;
  monthly_inr_low: number;
  monthly_inr_high: number;
  price_trend: "flat" | "decreasing" | "increasing";
  price_trend_note: string;
  price_stable: boolean;
};

export type DocumentAnalysis = {
  status: "success" | "generic" | "limited";
  filename: string;
  file_size_bytes: number;
  word_count: number;
  components: DocComponent[];
  total_monthly_inr_low: number;
  total_monthly_inr_high: number;
  recommended_resources: {
    cpu: number;
    memory: number;
    gpu: boolean;
    priority: string;
    region: string;
  };
  summary: string;
  tech_signals: string[];
  message?: string;
};

type Props = {
  onAnalysisComplete?: (analysis: DocumentAnalysis) => void;
  onAnalysisReset?: () => void;
};

// ─── Cloud badge colours ───────────────────────────────────────────────────────
const cloudBadge: Record<string, string> = {
  AWS: "provider-badge aws provider-text aws",
  Azure: "provider-badge azure provider-text azure",
  GCP: "provider-badge gcp provider-text gcp",
};

const trendIcon: Record<string, { label: string; cls: string }> = {
  flat: { label: "Stable price", cls: "text-slate-400" },
  decreasing: { label: "↓ Dropping", cls: "text-emerald-400" },
  increasing: { label: "↑ Rising", cls: "text-rose-400" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentAnalyzer({ onAnalysisComplete, onAnalysisReset }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function processFile(f: File) {
    setFile(f);
    setAnalysis(null);
    setError(null);
    setExpandedId(null);
    setAnalyzing(true);

    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/documents/analyze", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data: DocumentAnalysis = await res.json();
      setAnalysis(data);
      if (onAnalysisComplete) onAnalysisComplete(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  }

  function removeFile() {
    setFile(null);
    setAnalysis(null);
    setError(null);
    onAnalysisReset?.();
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="doc-analyzer-title">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">01 / Architecture</p>
          <h2 id="doc-analyzer-title" className="mt-1 text-lg font-semibold text-foreground">
            Upload Tech Stack Doc
          </h2>
        </div>
        <FileText className="size-5 text-primary" />
      </div>

      {/* Upload area or file card */}
      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
            dragging
              ? "drag-active border-primary bg-primary/10"
              : "border-border-strong bg-secondary/20 hover:border-primary/50 hover:bg-primary/5",
          )}
        >
          <FileUp className="mx-auto size-8 text-primary mb-2" />
          <p className="text-sm font-semibold text-foreground">Drop your architecture doc here</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            PDF, Word (.docx), Markdown, or plain text<br />
            describing your project's tech stack or architecture
          </p>
          <Button
            type="button" variant="outline" size="sm" className="browse-files-button mt-4 text-xs gap-1.5"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          >
            <FileUp className="size-3.5" />
            Browse files
          </Button>
        </div>
      ) : (
        <div className="upload-file-card rounded-xl border border-primary/30 bg-primary/5 p-3.5">
          <div className="flex items-center gap-3">
            <FileCode2 className="size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            {!analyzing && (
              <Button type="button" variant="ghost" size="icon" onClick={removeFile} title="Remove file">
                <X className="size-4" />
              </Button>
            )}
          </div>

          {analyzing && (
            <div className="mt-3 flex items-center gap-2 text-xs text-primary bg-primary/10 p-2.5 rounded-lg border border-primary/20">
              <LoaderCircle className="size-4 animate-spin shrink-0" />
              <span>Analyzing architecture document…</span>
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.docx,.doc,.md,.txt,.yaml,.yml,.json,.rst"
        onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }}
      />

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
          <AlertTriangle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !analyzing && (
        <div className="mt-4 space-y-3">
          {/* Summary bar */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="size-3.5 text-primary shrink-0" />
              <span className="text-xs font-semibold text-primary">Analysis complete</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{analysis.summary}</p>
            {analysis.total_monthly_inr_low > 0 && (
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Est. monthly cloud spend:</span>
                <span className="font-mono font-semibold text-foreground">
                  ₹{analysis.total_monthly_inr_low.toLocaleString()} – ₹{analysis.total_monthly_inr_high.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Component list */}
          {analysis.components.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                Detected Components ({analysis.components.length})
              </p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                {analysis.components.map((comp) => {
                  const isOpen = expandedId === comp.id;
                  const trend = trendIcon[comp.price_trend];
                  return (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : comp.id)}
                      className="w-full text-left rounded-lg border border-border bg-secondary/30 hover:border-border-strong hover:bg-secondary/50 transition-all px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{comp.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-foreground truncate">{comp.name}</span>
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-medium shrink-0", cloudBadge[comp.recommended_cloud] ?? "bg-secondary")}>
                              {comp.recommended_cloud}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{comp.category}</span>
                            <span className={cn("text-[10px] font-medium", trend.cls)}>{trend.label}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground ml-1">{isOpen ? "▲" : "▼"}</span>
                      </div>

                      {isOpen && (
                        <div className="mt-2 pt-2 border-t border-border/60 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Cloud services */}
                          <div className="grid grid-cols-3 gap-1 text-[10px]">
                            {(["AWS", "Azure", "GCP"] as const).map((cloud) => {
                              const svc = cloud === "AWS" ? comp.aws_service : cloud === "Azure" ? comp.azure_service : comp.gcp_service;
                              const isRec = comp.recommended_cloud === cloud;
                              return (
                                <div key={cloud} className={cn("rounded px-1.5 py-1 border", isRec ? cloudBadge[cloud] : "border-border bg-secondary/20 text-muted-foreground")}>
                                  <p className="font-semibold">{cloud}{isRec ? " ✓" : ""}</p>
                                  <p className="opacity-80 leading-relaxed" style={{ fontSize: "9px" }}>{svc}</p>
                                </div>
                              );
                            })}
                          </div>
                          {/* Cost */}
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Est. monthly:</span>
                            <span className="font-mono font-semibold text-foreground">
                              ₹{comp.monthly_inr_low.toLocaleString()} – ₹{comp.monthly_inr_high.toLocaleString()}
                            </span>
                          </div>
                          {/* Price trend note */}
                          <p className="text-[10px] text-muted-foreground italic leading-relaxed border-t border-border/40 pt-1.5">
                            {comp.price_trend_note}
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload another */}
          <Button
            type="button" variant="outline" size="sm"
            className="w-full text-xs mt-1"
            onClick={() => { removeFile(); setTimeout(() => inputRef.current?.click(), 50); }}
          >
            Upload a different document
          </Button>
        </div>
      )}

      {/* Hint when no file loaded */}
      {!file && (
        <div className="mt-4 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">What we detect</p>
          {[
            "Frontend / Web stack (React, Vue, Next.js…)",
            "Backend APIs & microservices",
            "Databases (SQL, NoSQL, cache)",
            "ML training & inference pipelines",
            "Container orchestration (Kubernetes)",
            "CI/CD, auth, messaging, monitoring",
          ].map((hint) => (
            <div key={hint} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles className="size-3 text-primary shrink-0" />
              {hint}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

