"""
Document Analysis API Router
Parses uploaded PDFs, Word docs, and text files to extract tech stack / architecture components.
Maps each detected component to the optimal cloud service and generates a per-component cost breakdown.
"""

import io
import re
from fastapi import APIRouter, UploadFile, File
from typing import List, Dict, Any, Optional
from ..optimizer.cloud_catalog import PROVIDER_PROFILES, USD_TO_INR

router = APIRouter(prefix="/api/documents", tags=["Document Intelligence"])

# ---------------------------------------------------------------------------
# Component definition catalogue
# Each entry: keywords → component meta + cloud service recommendations
# ---------------------------------------------------------------------------
COMPONENT_CATALOGUE: List[Dict[str, Any]] = [
    {
        "id": "frontend",
        "name": "Frontend / Web UI",
        "keywords": ["react", "vue", "angular", "nextjs", "next.js", "svelte", "vite", "webpack", "nuxt", "gatsby",
                     "frontend", "web ui", "spa", "single page", "static site", "html", "css", "tailwind",
                     "typescript", "javascript", "cdn", "client-side", "browser"],
        "aws_service": "S3 + CloudFront CDN",
        "azure_service": "Azure Static Web Apps",
        "gcp_service": "Firebase Hosting / Cloud CDN",
        "recommended_cloud": "AWS",
        "category": "Content Delivery",
        "cpu_equiv": 0,
        "memory_equiv": 0,
        "monthly_cost_usd_low": 1.0,
        "monthly_cost_usd_high": 15.0,
        "price_stable": True,
        "price_trend": "flat",
        "price_trend_note": "CDN pricing is highly stable; AWS S3+CloudFront costs drop ~2–3% per year with bandwidth commitments.",
        "icon": "🌐",
    },
    {
        "id": "api_backend",
        "name": "REST / GraphQL API Backend",
        "keywords": ["fastapi", "express", "django", "flask", "spring boot", "rails", "laravel", "graphql",
                     "rest api", "restful", "backend", "api server", "http server", "microservice", "endpoint",
                     "nginx", "gunicorn", "uvicorn", "node.js", "nodejs", "golang", "go http"],
        "aws_service": "ECS Fargate / EC2 t3.large",
        "azure_service": "Azure Container Apps",
        "gcp_service": "Cloud Run",
        "recommended_cloud": "GCP",
        "category": "Compute",
        "cpu_equiv": 4,
        "memory_equiv": 16,
        "monthly_cost_usd_low": 60.0,
        "monthly_cost_usd_high": 150.0,
        "price_stable": True,
        "price_trend": "decreasing",
        "price_trend_note": "GCP Cloud Run is projected to decrease ~4–6% over next 6 months due to Axion ARM capacity expansion.",
        "icon": "⚡",
    },
    {
        "id": "ml_training",
        "name": "ML Model Training",
        "keywords": ["training", "train model", "fine-tune", "finetune", "fine tune", "gradient descent", "backprop",
                     "epoch", "batch size", "pytorch", "tensorflow", "keras", "jax", "transformers", "huggingface",
                     "mlflow", "wandb", "gpu training", "distributed training", "deepspeed", "megatron"],
        "aws_service": "SageMaker Training Jobs (p3.8xlarge)",
        "azure_service": "Azure ML Compute Clusters",
        "gcp_service": "Vertex AI Training (A100)",
        "recommended_cloud": "AWS",
        "category": "ML Compute (GPU)",
        "cpu_equiv": 32,
        "memory_equiv": 128,
        "monthly_cost_usd_low": 400.0,
        "monthly_cost_usd_high": 2400.0,
        "price_stable": False,
        "price_trend": "decreasing",
        "price_trend_note": "GPU compute prices dropped ~12% in 2025 and forecast to drop another 8–10% through 2026 due to H100/B200 supply expansion.",
        "icon": "🔥",
    },
    {
        "id": "ml_inference",
        "name": "ML Inference / Model Serving",
        "keywords": ["inference", "prediction", "serving", "model server", "triton", "torchserve", "tensorflow serving",
                     "bentoml", "seldon", "kserve", "onnx runtime", "model endpoint", "predict", "embedding",
                     "vector search", "similarity search", "real-time inference"],
        "aws_service": "SageMaker Endpoints / Inferentia2",
        "azure_service": "Azure ML Online Endpoints",
        "gcp_service": "Vertex AI Prediction",
        "recommended_cloud": "AWS",
        "category": "ML Inference",
        "cpu_equiv": 8,
        "memory_equiv": 32,
        "monthly_cost_usd_low": 120.0,
        "monthly_cost_usd_high": 800.0,
        "price_stable": False,
        "price_trend": "decreasing",
        "price_trend_note": "AWS Inferentia2 custom chips are 40% cheaper than GPU instances; inference costs projected to drop 6–8% in next 2 quarters.",
        "icon": "🤖",
    },
    {
        "id": "database_relational",
        "name": "Relational Database",
        "keywords": ["postgresql", "postgres", "mysql", "mariadb", "sql server", "oracle db", "sqlite",
                     "relational database", "rdbms", "sql", "transactions", "acid", "primary key", "foreign key",
                     "joins", "stored procedure", "aurora", "cloud sql", "azure sql"],
        "aws_service": "RDS Aurora PostgreSQL (db.r6g.large)",
        "azure_service": "Azure Database for PostgreSQL",
        "gcp_service": "Cloud SQL PostgreSQL",
        "recommended_cloud": "AWS",
        "category": "Managed Database",
        "cpu_equiv": 4,
        "memory_equiv": 16,
        "monthly_cost_usd_low": 80.0,
        "monthly_cost_usd_high": 300.0,
        "price_stable": True,
        "price_trend": "flat",
        "price_trend_note": "RDS pricing has been flat for 18 months; reserved instances offer 30–40% savings with 1-year commitment.",
        "icon": "🗄️",
    },
    {
        "id": "database_nosql",
        "name": "NoSQL / Document Store",
        "keywords": ["mongodb", "dynamodb", "firestore", "cosmos db", "cassandra", "redis", "elasticsearch",
                     "opensearch", "couchdb", "nosql", "document store", "key-value", "wide column",
                     "cache", "memcached", "in-memory", "ttl", "session store"],
        "aws_service": "DynamoDB + ElastiCache Redis",
        "azure_service": "Cosmos DB + Azure Cache",
        "gcp_service": "Firestore + Memorystore",
        "recommended_cloud": "GCP",
        "category": "NoSQL Database",
        "cpu_equiv": 2,
        "memory_equiv": 8,
        "monthly_cost_usd_low": 25.0,
        "monthly_cost_usd_high": 200.0,
        "price_stable": True,
        "price_trend": "flat",
        "price_trend_note": "DynamoDB and Firestore pricing is stable. GCP Firestore recently lowered free tier limits but pricing unchanged.",
        "icon": "📦",
    },
    {
        "id": "message_queue",
        "name": "Message Queue / Event Streaming",
        "keywords": ["kafka", "rabbitmq", "sqs", "sns", "pubsub", "pub/sub", "message queue", "event bus",
                     "event streaming", "celery", "worker", "consumer", "producer", "topic", "partition",
                     "dead letter queue", "dlq", "amqp", "nats", "kinesis"],
        "aws_service": "SQS + MSK (Managed Kafka)",
        "azure_service": "Azure Service Bus / Event Hubs",
        "gcp_service": "Cloud Pub/Sub",
        "recommended_cloud": "GCP",
        "category": "Messaging",
        "cpu_equiv": 2,
        "memory_equiv": 8,
        "monthly_cost_usd_low": 10.0,
        "monthly_cost_usd_high": 120.0,
        "price_stable": True,
        "price_trend": "flat",
        "price_trend_note": "GCP Pub/Sub is a pay-per-message model with stable pricing; SQS rates unchanged since 2021.",
        "icon": "📨",
    },
    {
        "id": "object_storage",
        "name": "Object / File Storage",
        "keywords": ["s3", "blob storage", "gcs", "object storage", "file storage", "bucket", "upload", "download",
                     "media storage", "image storage", "artifact store", "data lake", "datalake", "minio",
                     "backups", "archival", "glacier"],
        "aws_service": "S3 Standard / Intelligent-Tiering",
        "azure_service": "Azure Blob Storage",
        "gcp_service": "Cloud Storage",
        "recommended_cloud": "AWS",
        "category": "Storage",
        "cpu_equiv": 0,
        "memory_equiv": 0,
        "monthly_cost_usd_low": 2.0,
        "monthly_cost_usd_high": 50.0,
        "price_stable": True,
        "price_trend": "decreasing",
        "price_trend_note": "S3 storage prices have declined ~5% per year historically and AWS has tiered pricing for high volumes.",
        "icon": "🗃️",
    },
    {
        "id": "container_orchestration",
        "name": "Container Orchestration",
        "keywords": ["kubernetes", "k8s", "docker", "docker-compose", "helm", "kubectl", "eks", "aks", "gke",
                     "container", "pod", "deployment", "service mesh", "istio", "envoy", "ingress controller",
                     "horizontal pod autoscaler", "hpa", "daemonset"],
        "aws_service": "EKS (Elastic Kubernetes Service)",
        "azure_service": "AKS (Azure Kubernetes Service)",
        "gcp_service": "GKE Autopilot",
        "recommended_cloud": "GCP",
        "category": "Orchestration",
        "cpu_equiv": 8,
        "memory_equiv": 32,
        "monthly_cost_usd_low": 100.0,
        "monthly_cost_usd_high": 400.0,
        "price_stable": False,
        "price_trend": "decreasing",
        "price_trend_note": "GKE Autopilot pricing is node-based and projected to benefit from ARM capacity discounts in 2026.",
        "icon": "☸️",
    },
    {
        "id": "auth_security",
        "name": "Authentication / Security",
        "keywords": ["authentication", "authorization", "oauth", "jwt", "saml", "sso", "auth0", "okta",
                     "cognito", "identity", "iam", "rbac", "firewall", "waf", "ssl", "tls", "certificate",
                     "secrets manager", "vault", "kms", "encryption", "api gateway", "rate limiting"],
        "aws_service": "Cognito + API Gateway + WAF",
        "azure_service": "Azure AD B2C + APIM",
        "gcp_service": "Firebase Auth + Cloud Endpoints",
        "recommended_cloud": "AWS",
        "category": "Security & Identity",
        "cpu_equiv": 0,
        "memory_equiv": 0,
        "monthly_cost_usd_low": 5.0,
        "monthly_cost_usd_high": 60.0,
        "price_stable": True,
        "price_trend": "flat",
        "price_trend_note": "Auth and API gateway pricing is very stable; Cognito MAU pricing has not changed since 2022.",
        "icon": "🔐",
    },
    {
        "id": "monitoring_logging",
        "name": "Monitoring / Logging / Observability",
        "keywords": ["monitoring", "logging", "observability", "prometheus", "grafana", "datadog", "cloudwatch",
                     "azure monitor", "cloud logging", "opentelemetry", "tracing", "jaeger", "zipkin",
                     "alerting", "pagerduty", "sentry", "newrelic", "metrics", "dashboard"],
        "aws_service": "CloudWatch + X-Ray",
        "azure_service": "Azure Monitor + App Insights",
        "gcp_service": "Cloud Monitoring + Trace",
        "recommended_cloud": "AWS",
        "category": "Observability",
        "cpu_equiv": 0,
        "memory_equiv": 0,
        "monthly_cost_usd_low": 10.0,
        "monthly_cost_usd_high": 80.0,
        "price_stable": True,
        "price_trend": "flat",
        "price_trend_note": "CloudWatch pricing stable; log retention costs can be optimized with S3 export policies.",
        "icon": "📊",
    },
    {
        "id": "ci_cd",
        "name": "CI/CD Pipeline",
        "keywords": ["ci/cd", "cicd", "continuous integration", "continuous deployment", "github actions",
                     "gitlab ci", "jenkins", "codepipeline", "azure devops", "cloud build", "argocd",
                     "pipeline", "build", "deploy", "release", "artifact registry", "container registry"],
        "aws_service": "CodePipeline + CodeBuild + ECR",
        "azure_service": "Azure DevOps + ACR",
        "gcp_service": "Cloud Build + Artifact Registry",
        "recommended_cloud": "GCP",
        "category": "DevOps",
        "cpu_equiv": 0,
        "memory_equiv": 0,
        "monthly_cost_usd_low": 5.0,
        "monthly_cost_usd_high": 40.0,
        "price_stable": True,
        "price_trend": "flat",
        "price_trend_note": "GCP Cloud Build has 120 free build-minutes per day; pricing stable and competitive.",
        "icon": "🔄",
    },
    {
        "id": "data_pipeline",
        "name": "Data Pipeline / ETL",
        "keywords": ["etl", "elt", "data pipeline", "airflow", "spark", "flink", "glue", "databricks",
                     "dataflow", "dbt", "transform", "data warehouse", "bigquery", "snowflake", "redshift",
                     "data lake", "delta lake", "iceberg", "dask", "polars", "batch processing"],
        "aws_service": "AWS Glue + Redshift Serverless",
        "azure_service": "Azure Data Factory + Synapse",
        "gcp_service": "Dataflow + BigQuery",
        "recommended_cloud": "GCP",
        "category": "Data Engineering",
        "cpu_equiv": 16,
        "memory_equiv": 64,
        "monthly_cost_usd_low": 50.0,
        "monthly_cost_usd_high": 500.0,
        "price_stable": False,
        "price_trend": "flat",
        "price_trend_note": "BigQuery is pay-per-query; flat monthly estimates depend heavily on data volume. GCP recently introduced BigQuery Edition pricing.",
        "icon": "🔀",
    },
]


def extract_text_from_file(content: bytes, filename: str) -> str:
    """Extract plain text from PDF, Word doc, or plain text files."""
    lower = filename.lower()
    text = ""

    # PDF extraction
    if lower.endswith(".pdf"):
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            pages = [page.extract_text() or "" for page in reader.pages]
            text = "\n".join(pages)
        except ImportError:
            # Fallback: try pdfplumber
            try:
                import pdfplumber
                with pdfplumber.open(io.BytesIO(content)) as pdf:
                    text = "\n".join(p.extract_text() or "" for p in pdf.pages)
            except ImportError:
                # Raw bytes fallback — extract ASCII-printable runs
                text = content.decode("latin-1", errors="ignore")
        except Exception as e:
            text = content.decode("latin-1", errors="ignore")

    # Word document
    elif lower.endswith((".docx",)):
        try:
            import docx
            doc = docx.Document(io.BytesIO(content))
            text = "\n".join(para.text for para in doc.paragraphs)
        except ImportError:
            text = content.decode("utf-8", errors="ignore")
        except Exception:
            text = content.decode("utf-8", errors="ignore")

    # Markdown, text, YAML, JSON, code files — just decode
    else:
        text = content.decode("utf-8", errors="ignore")

    return text


def score_component(text_lower: str, component: Dict[str, Any]) -> int:
    """Return keyword match count for a component."""
    return sum(1 for kw in component["keywords"] if kw in text_lower)


def detect_components(text: str) -> List[Dict[str, Any]]:
    """Score each component and return those with at least 1 keyword match, sorted by score desc."""
    text_lower = text.lower()
    scored = []
    for comp in COMPONENT_CATALOGUE:
        score = score_component(text_lower, comp)
        if score > 0:
            scored.append((score, comp))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [comp for _, comp in scored]


def cost_inr(usd_low: float, usd_high: float) -> Dict[str, float]:
    return {
        "monthly_inr_low": round(usd_low * USD_TO_INR, 0),
        "monthly_inr_high": round(usd_high * USD_TO_INR, 0),
    }


@router.post(
    "/analyze",
    summary="Analyze Tech Stack / Architecture Document",
    description=(
        "Upload a PDF, Word doc (.docx), Markdown, or plain text file describing a project's architecture or tech stack. "
        "The engine extracts architecture components, maps each to the optimal cloud service, and provides a per-component "
        "cost breakdown with price trend forecasts."
    )
)
async def analyze_document(file: UploadFile = File(...)):
    filename = file.filename or "document"
    content = await file.read()
    file_size = len(content)

    # Extract text
    text = extract_text_from_file(content, filename)
    word_count = len(text.split())

    if word_count < 10:
        # Very little text extracted — probably a scanned PDF or binary
        return {
            "status": "limited",
            "filename": filename,
            "file_size_bytes": file_size,
            "word_count": word_count,
            "message": "Could not extract readable text from this file. Please upload a text-based PDF, .docx, .md, or .txt file.",
            "components": [],
            "total_monthly_inr_low": 0,
            "total_monthly_inr_high": 0,
            "recommended_resources": {"cpu": 8, "memory": 32, "gpu": False, "priority": "medium", "region": "India"},
            "summary": "Unable to analyze: file contains no extractable text.",
            "tech_signals": [],
        }

    # Detect components
    detected = detect_components(text)

    if not detected:
        # No known tech keywords found — still return a reasonable baseline
        return {
            "status": "generic",
            "filename": filename,
            "file_size_bytes": file_size,
            "word_count": word_count,
            "message": "No specific tech stack keywords detected. Returning baseline cloud compute estimate.",
            "components": [],
            "total_monthly_inr_low": round(60 * USD_TO_INR, 0),
            "total_monthly_inr_high": round(200 * USD_TO_INR, 0),
            "recommended_resources": {"cpu": 4, "memory": 16, "gpu": False, "priority": "medium", "region": "India"},
            "summary": f"Document analyzed ({word_count} words). No specific cloud services detected — providing generic compute baseline.",
            "tech_signals": [],
        }

    # Build per-component response
    components_out = []
    total_cpu = 0
    total_memory = 0
    needs_gpu = False
    total_low_usd = 0.0
    total_high_usd = 0.0
    tech_signals = []

    for comp in detected:
        costs = cost_inr(comp["monthly_cost_usd_low"], comp["monthly_cost_usd_high"])
        components_out.append({
            "id": comp["id"],
            "name": comp["name"],
            "icon": comp["icon"],
            "category": comp["category"],
            "recommended_cloud": comp["recommended_cloud"],
            "aws_service": comp["aws_service"],
            "azure_service": comp["azure_service"],
            "gcp_service": comp["gcp_service"],
            "monthly_cost_usd_low": comp["monthly_cost_usd_low"],
            "monthly_cost_usd_high": comp["monthly_cost_usd_high"],
            "monthly_inr_low": costs["monthly_inr_low"],
            "monthly_inr_high": costs["monthly_inr_high"],
            "price_trend": comp["price_trend"],
            "price_trend_note": comp["price_trend_note"],
            "price_stable": comp["price_stable"],
        })
        total_cpu += comp["cpu_equiv"]
        total_memory += comp["memory_equiv"]
        total_low_usd += comp["monthly_cost_usd_low"]
        total_high_usd += comp["monthly_cost_usd_high"]

        if comp["id"] in ("ml_training", "ml_inference"):
            needs_gpu = True

        tech_signals.append(f"{comp['icon']} {comp['name']} detected")

    # Cap resource recommendations at sane limits
    rec_cpu = min(max(total_cpu, 4), 64)
    rec_memory = min(max(total_memory, 16), 256)

    # Decide priority based on ML presence
    priority = "high" if needs_gpu else "medium"

    summary_parts = [f"{len(detected)} architecture component{'s' if len(detected) != 1 else ''} detected"]
    if needs_gpu:
        summary_parts.append("GPU compute required (ML training/inference found)")
    summary = (
        f"Analyzed '{filename}' ({word_count} words). "
        + ", ".join(summary_parts)
        + f". Estimated monthly cloud spend: ₹{round(total_low_usd * USD_TO_INR):,} – ₹{round(total_high_usd * USD_TO_INR):,}."
    )

    return {
        "status": "success",
        "filename": filename,
        "file_size_bytes": file_size,
        "word_count": word_count,
        "components": components_out,
        "total_monthly_usd_low": round(total_low_usd, 2),
        "total_monthly_usd_high": round(total_high_usd, 2),
        "total_monthly_inr_low": round(total_low_usd * USD_TO_INR, 0),
        "total_monthly_inr_high": round(total_high_usd * USD_TO_INR, 0),
        "recommended_resources": {
            "cpu": rec_cpu,
            "memory": rec_memory,
            "gpu": needs_gpu,
            "priority": priority,
            "region": "India",
        },
        "summary": summary,
        "tech_signals": tech_signals,
    }


@router.post(
    "/interactive-cost",
    summary="Compute Interactive Cost Projection",
    description="Given CPU, memory, GPU, region, priority — return a full time-series cost projection for the interactive graph."
)
async def interactive_cost(payload: Dict[str, Any] = None):
    """This endpoint is called via GET with query params for simplicity."""
    return {"error": "Use GET /api/documents/interactive-cost?cpu=8&memory=32&gpu=false&region=India&priority=medium"}


from fastapi import Query

@router.get(
    "/interactive-cost",
    summary="Interactive Cost Projection for Slider Graph",
)
async def get_interactive_cost(
    cpu: int = Query(8, ge=1, le=64),
    memory: int = Query(32, ge=2, le=256),
    gpu: bool = Query(False),
    region: str = Query("India"),
    priority: str = Query("medium"),
):
    """
    Returns per-provider cost projections (historical baseline + forecast at selected resource level).
    Used by the interactive graph slider in the frontend.
    """
    from ..optimizer.cloud_catalog import PRIORITY_DISCOUNTS

    region_key = region if region in ["India", "US", "Europe"] else "India"
    priority_info = PRIORITY_DISCOUNTS.get(priority.lower(), PRIORITY_DISCOUNTS["medium"])
    priority_mult = priority_info["multiplier"]

    result = {}
    for cloud_code, profile in PROVIDER_PROFILES.items():
        reg_data = profile["regions"][region_key]
        reg_mult = reg_data["multiplier"]

        cpu_cost = cpu * profile["base_cpu_hour_usd"]
        ram_cost = memory * profile["base_ram_gb_hour_usd"]
        gpu_cost = (profile["gpu_unit_hour_usd"] * max(1, cpu // 8)) if gpu else 0.0

        hourly_usd = round((cpu_cost + ram_cost + gpu_cost) * reg_mult * priority_mult, 4)
        monthly_usd = round(hourly_usd * 730, 2)
        hourly_inr = round(hourly_usd * USD_TO_INR, 2)
        monthly_inr = round(monthly_usd * USD_TO_INR, 2)

        # Resource mix changes the curve shape as well as its absolute price.
        # Larger memory footprints and GPU capacity generally have more volatile
        # historical spot/accelerator pricing than a small CPU-only service.
        resource_intensity = (
            ((cpu - 1) / 63) * 0.45
            + ((memory - 2) / 254) * 0.35
            + (0.20 if gpu else 0.0)
        )
        resource_shape = min(
            1.0,
            max(
                0.25,
                resource_intensity
                + (0.12 if priority.lower() == "high" else (-0.12 if priority.lower() == "low" else 0.0)),
            ),
        )

        # Build 12-point time series: 6 past (scaled) + current + 5 forecast
        decay_rates = {"AWS": 0.985, "Azure": 0.990, "GCP": 0.982}
        dr = decay_rates.get(cloud_code, 0.985) - resource_shape * 0.02

        series = []
        months = ["Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026", "Feb 2026", "Mar 2026",
                  "Apr 2026 (Now)", "May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026"]
        # Historical prices scaled back from current
        base_historical_scale = [1.35, 1.28, 1.21, 1.14, 1.08, 1.04]
        sharp_market_moves = [0.22, -0.16, 0.25, -0.13, 0.18, -0.06]
        historical_scale = [
            scale + (move * resource_shape)
            for scale, move in zip(base_historical_scale, sharp_market_moves)
        ]
        for i, scale in enumerate(historical_scale):
            series.append({
                "period": months[i],
                "price": round(hourly_inr * scale, 2),
                "stage": "historical",
            })

        # Current
        series.append({"period": months[6], "price": hourly_inr, "stage": "current"})

        # Forecast
        forecast_moves = [1.0 + 0.06 * resource_shape, 1.0 - 0.04 * resource_shape,
                  1.0 + 0.08 * resource_shape, 1.0 - 0.03 * resource_shape,
                  1.0 + 0.05 * resource_shape]
        forecast_mults = [dr**(index + 1) * move for index, move in enumerate(forecast_moves)]
        for i, fm in enumerate(forecast_mults):
            fp = round(hourly_inr * fm, 2)
            series.append({
                "period": months[7 + i],
                "price": fp,
                "stage": "forecast",
                "lower_bound": round(fp * 0.94, 2),
                "upper_bound": round(fp * 1.03, 2),
            })

        result[cloud_code] = {
            "hourly_inr": hourly_inr,
            "monthly_inr": monthly_inr,
            "hourly_usd": hourly_usd,
            "monthly_usd": monthly_usd,
            "series": series,
        }

    return {
        "config": {"cpu": cpu, "memory": memory, "gpu": gpu, "region": region_key, "priority": priority},
        "currency": "INR",
        "providers": result,
    }
