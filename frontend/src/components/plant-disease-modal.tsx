import { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileImage,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Upload,
  X,
  Stethoscope,
  ShieldAlert,
  Sprout,
  Pill,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type SampleImage = {
  id: string;
  filename: string;
  class: string;
  label: string;
  data_url: string;
};

type PredictionResult = {
  status: string;
  predicted_class: string;
  display_name: string;
  confidence_pct: number;
  is_healthy: boolean;
  class_probabilities: Record<string, number>;
  diagnostic_report: {
    common_name: string;
    scientific_name: string;
    affected_crop: string;
    health_status: string;
    severity: string;
    symptoms: string[];
    causes: string[];
    organic_treatments: string[];
    chemical_treatments: string[];
    prevention: string[];
  };
  model_summary: {
    model_type: string;
    cv_accuracy: number;
  };
};

export function PlantDiseaseModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [samples, setSamples] = useState<SampleImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch pre-loaded samples from backend
  useEffect(() => {
    if (isOpen) {
      fetch("/api/plant/samples")
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          if (data?.samples) setSamples(data.samples);
        })
        .catch(() => {
          // Fallback if backend sample endpoint fails
        });
    }
  }, [isOpen]);

  async function diagnoseImage(dataUrl: string, fileName?: string) {
    setSelectedImage(dataUrl);
    setSelectedFileName(fileName ?? "Selected Leaf Image");
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/plant/predict-base64", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: dataUrl }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.detail ?? `Inference failed with HTTP ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inference failed. Check backend connection.");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        diagnoseImage(reader.result, file.name);
      }
    };
    reader.readAsDataURL(file);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-border bg-[#101423] p-6 shadow-2xl text-foreground max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Sprout className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-foreground">
                  plant-api: Leaf Pathology Diagnostic Suite
                </h3>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  96.7% Cross-Val Accuracy
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Trained vision classifier distinguishing Apple Black Rot (*Botryosphaeria obtusa*) from Healthy foliage.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Quick Sample Selector */}
        <div className="mt-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            1. Quick Test with Dataset Samples
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {samples.map((sample, idx) => (
              <button
                key={sample.id || idx}
                onClick={() => diagnoseImage(sample.data_url, sample.filename)}
                className={`group flex items-center gap-2.5 rounded-lg border p-2 text-left transition-all ${
                  selectedImage === sample.data_url
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-secondary/30 hover:border-border-strong hover:bg-secondary/60"
                }`}
              >
                <img
                  src={sample.data_url}
                  alt={sample.label}
                  className="size-10 rounded-md object-cover border border-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {sample.class.includes("Black_rot") ? "🍂 Black Rot" : "🌿 Healthy"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Sample #{idx + 1}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Upload Zone */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            2. Or Upload Custom Apple Leaf
          </p>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-5 text-center cursor-pointer hover:border-primary/60 hover:bg-secondary/20 transition-colors"
          >
            <Upload className="size-6 text-primary mb-2" />
            <p className="text-sm font-medium text-foreground">
              Click to select or drag and drop leaf photo
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Supports JPEG, JPG, PNG from PlantVillage or camera
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>

        {/* Analysis Status */}
        {analyzing && (
          <div className="mt-6 flex flex-col items-center justify-center p-8 rounded-xl border border-border bg-secondary/10">
            <LoaderCircle className="size-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-semibold text-foreground">Running Visual Pathology Analysis…</p>
            <p className="text-xs text-muted-foreground mt-1">
              Extracting color moments, HSV spectrum histograms, and lesion texture spatial gradients.
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive flex items-center gap-3">
            <AlertTriangle className="size-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Results Panel */}
        {result && !analyzing && (
          <div className="mt-6 rounded-xl border border-border bg-secondary/20 p-5 space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-4">
                {selectedImage && (
                  <img
                    src={selectedImage}
                    alt="Analyzed leaf"
                    className="size-16 rounded-xl object-cover border border-border shadow-md"
                  />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                        result.is_healthy
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-red-500/20 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {result.is_healthy ? (
                        <CheckCircle2 className="size-3.5" />
                      ) : (
                        <AlertTriangle className="size-3.5" />
                      )}
                      {result.diagnostic_report.health_status.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {result.confidence_pct}% Confidence
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-foreground mt-1">
                    {result.display_name}
                  </h4>
                  <p className="text-xs text-muted-foreground italic">
                    {result.diagnostic_report.scientific_name}
                  </p>
                </div>
              </div>

              {/* Confidence Meter */}
              <div className="w-full sm:w-48 bg-secondary/50 p-2.5 rounded-lg border border-border">
                <div className="flex justify-between text-[11px] mb-1 font-mono">
                  <span className="text-muted-foreground">Confidence</span>
                  <span className="text-foreground font-semibold">
                    {result.confidence_pct}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      result.is_healthy ? "bg-emerald-500" : "bg-red-500"
                    }`}
                    style={{ width: `${result.confidence_pct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Symptoms & Pathogen Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-[#0d101d] p-4">
                <div className="flex items-center gap-2 mb-2 text-primary font-semibold text-xs uppercase tracking-wide">
                  <Stethoscope className="size-4" />
                  Visual Pathology & Symptoms
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
                  {result.diagnostic_report.symptoms.map((symptom, i) => (
                    <li key={i}>{symptom}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-border bg-[#0d101d] p-4">
                <div className="flex items-center gap-2 mb-2 text-amber-400 font-semibold text-xs uppercase tracking-wide">
                  <ShieldAlert className="size-4" />
                  Etiology & Spread Vector
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
                  {result.diagnostic_report.causes.map((cause, i) => (
                    <li key={i}>{cause}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Treatment recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-[#0d101d] p-4">
                <div className="flex items-center gap-2 mb-2 text-emerald-400 font-semibold text-xs uppercase tracking-wide">
                  <Sprout className="size-4" />
                  Organic & Cultural Controls
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
                  {result.diagnostic_report.organic_treatments.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-border bg-[#0d101d] p-4">
                <div className="flex items-center gap-2 mb-2 text-indigo-400 font-semibold text-xs uppercase tracking-wide">
                  <Pill className="size-4" />
                  Chemical & Prevention Controls
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
                  {result.diagnostic_report.chemical_treatments.concat(
                    result.diagnostic_report.prevention.slice(0, 2)
                  ).map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close Diagnostic Suite
          </Button>
        </div>
      </div>
    </div>
  );
}

