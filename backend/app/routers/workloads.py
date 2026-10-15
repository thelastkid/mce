"""
Workloads API Router
Metadata for predefined applications and smart file analyzer for any uploaded workload.
Integrates live Plant Disease Computer Vision inference when leaf images or datasets are uploaded.
"""

import os
import io
import zipfile
import tarfile
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from typing import List, Dict, Any, Optional

router = APIRouter(prefix="/api/workloads", tags=["Workload Management"])

WORKLOADS_DB = [
    {
        "id": "plant-api",
        "name": "plant-api",
        "kind": "REST API",
        "category": "Computer Vision & Agro-Diagnostics",
        "description": "High-throughput real-time plant disease detection vision microservice.",
        "recommended": {
            "cpu": 8,
            "memory": 32,
            "gpu": False,
            "priority": "medium",
            "region": "India"
        },
        "ports": [8000],
        "health_check_path": "/health",
        "docker_image": "mlops/plant-disease-api:v1.0.0"
    },
    {
        "id": "nlp-inference-service",
        "name": "nlp-inference-service",
        "kind": "Inference",
        "category": "Natural Language Processing",
        "description": "Transformer LLM embedding and semantic retrieval inference service.",
        "recommended": {
            "cpu": 16,
            "memory": 64,
            "gpu": True,
            "priority": "high",
            "region": "US"
        },
        "ports": [8080],
        "health_check_path": "/healthz",
        "docker_image": "mlops/nlp-inference:v2.4"
    },
    {
        "id": "fraud-detection-pipeline",
        "name": "fraud-detection-pipeline",
        "kind": "Pipeline",
        "category": "Streaming Financial MLOps",
        "description": "Real-time Kafka + XGBoost transaction anomaly scoring pipeline.",
        "recommended": {
            "cpu": 32,
            "memory": 128,
            "gpu": False,
            "priority": "high",
            "region": "Europe"
        },
        "ports": [9092],
        "health_check_path": "/status",
        "docker_image": "mlops/fraud-pipeline:v3.1"
    }
]

def format_file_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"

def inspect_archive(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """Inspect contents of zip or tar archives to detect workload architecture."""
    entries = []
    first_image_bytes = None
    try:
        if filename.lower().endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
                entries = zf.namelist()
                for name in entries:
                    if name.lower().endswith(('.jpg', '.jpeg', '.png')) and not name.startswith("__MACOSX"):
                        try:
                            first_image_bytes = zf.read(name)
                            break
                        except Exception:
                            pass
        elif filename.lower().endswith((".tar", ".tar.gz", ".tgz")):
            with tarfile.open(fileobj=io.BytesIO(file_bytes)) as tf:
                entries = tf.getnames()
    except Exception:
        pass
    
    image_count = sum(1 for e in entries if e.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif')))
    model_count = sum(1 for e in entries if e.lower().endswith(('.pth', '.pt', '.onnx', '.h5', '.keras', '.tflite', '.bin', '.safetensors', '.joblib', '.pkl')))
    code_count = sum(1 for e in entries if e.lower().endswith(('.py', '.js', '.ts', '.go', '.rs', '.java', '.cpp', '.c')))
    has_docker = any("dockerfile" in e.lower() for e in entries)
    has_requirements = any("requirements.txt" in e.lower() or "package.json" in e.lower() or "pyproject.toml" in e.lower() for e in entries)
    has_data = any(e.lower().endswith(('.csv', '.parquet', '.jsonl', '.arrow')) for e in entries)
    
    return {
        "total_files": len(entries),
        "image_count": image_count,
        "model_count": model_count,
        "code_count": code_count,
        "has_docker": has_docker,
        "has_requirements": has_requirements,
        "has_data": has_data,
        "sample_entries": entries[:8],
        "first_image_bytes": first_image_bytes
    }

@router.get("", summary="List Available Workload Profiles")
async def list_workloads():
    return {"workloads": WORKLOADS_DB}

@router.get("/{workload_id}", summary="Get Workload Profile Details")
async def get_workload(workload_id: str):
    for w in WORKLOADS_DB:
        if w["id"] == workload_id:
            return w
    return {"error": "Workload not found"}

@router.post(
    "/analyze-file",
    summary="Scan & Analyze Any Uploaded Workload File",
    description="Inspects file type, archive content, model weights, data size, and auto-calculates recommended cloud resources."
)
async def analyze_workload_file(file: UploadFile = File(...)):
    filename = file.filename or "uploaded_workload"
    content = await file.read()
    file_size = len(content)
    lower_name = filename.lower()
    
    archive_info = None
    if lower_name.endswith(('.zip', '.tar', '.tar.gz', '.tgz')):
        archive_info = inspect_archive(content, filename)
    
    # Heuristic analysis engine
    cpu = 8
    memory = 32
    gpu = False
    priority = "medium"
    region = "India"
    workload_type = "General Cloud Service"
    reasoning = ""
    technical_signals = []
    leaf_diagnosis = None

    # Check for direct leaf image upload (e.g. apple leaf JPG/PNG)
    if lower_name.endswith(('.jpg', '.jpeg', '.png', '.webp', '.bmp')):
        try:
            from ..ml.model import predict_leaf_image
            leaf_pred = predict_leaf_image(content)
            leaf_diagnosis = leaf_pred
            workload_type = f"Plant Leaf Image ({leaf_pred['display_name']})"
            reasoning = f"Analyzed apple leaf image. Model diagnosed {leaf_pred['display_name']} with {leaf_pred['confidence_pct']}% confidence. Sized at 8 vCPUs and 32 GB RAM for microservice inference."
            technical_signals.append(f"Live Pathology: {leaf_pred['display_name']} ({leaf_pred['confidence_pct']}%)")
            technical_signals.append(f"Severity: {leaf_pred['diagnostic_report'].get('severity', 'None')}")
            cpu = 8
            memory = 32
            gpu = False
        except Exception:
            pass

    # 1. Archives containing Vision / Image Datasets (e.g., Apple Black Rot dataset zip)
    if not leaf_diagnosis and archive_info and archive_info["image_count"] > 10:
        count = archive_info["image_count"]
        workload_type = "Plant Pathology / Vision Dataset"
        
        # Test sample image from archive if available
        if archive_info.get("first_image_bytes"):
            try:
                from ..ml.model import predict_leaf_image
                leaf_pred = predict_leaf_image(archive_info["first_image_bytes"])
                leaf_diagnosis = leaf_pred
                technical_signals.append(f"Sample test: {leaf_pred['display_name']} ({leaf_pred['confidence_pct']}%)")
            except Exception:
                pass
                
        if count > 500:
            cpu = 16
            memory = 64
            gpu = True
            priority = "high"
            reasoning = f"Detected high-volume visual dataset ({count} images). Recommended 16 vCPUs, 64 GB RAM, and GPU accelerator for fast batch feature extraction and model fine-tuning."
        else:
            cpu = 8
            memory = 32
            gpu = True
            priority = "medium"
            reasoning = f"Detected visual image dataset ({count} images). Auto-configured 8 vCPUs, 32 GB RAM, and GPU acceleration for convolutional vision processing."
        technical_signals.append(f"{count} image assets identified")
        technical_signals.append("GPU acceleration configured for CNN/ViT processing")

    # 2. Deep Learning Models (.pth, .pt, .onnx, .safetensors, .bin, .h5, .keras)
    elif not leaf_diagnosis and (lower_name.endswith(('.safetensors', '.bin', '.pth', '.pt', '.onnx', '.h5', '.keras')) or (archive_info and archive_info["model_count"] > 0)):
        workload_type = "Neural Network / Deep Learning Weights"
        gpu = True
        if file_size > 500 * 1024 * 1024:  # > 500MB
            cpu = 32
            memory = 128
            priority = "high"
            region = "US"
            reasoning = f"Large deep neural network checkpoint ({format_file_size(file_size)}). High VRAM and 128 GB host memory allocated for transformer tensor parallel inference."
            technical_signals.append("Large Transformer / LLM architecture footprint")
        elif file_size > 50 * 1024 * 1024:  # 50MB - 500MB
            cpu = 16
            memory = 64
            priority = "high"
            reasoning = f"Medium neural network model ({format_file_size(file_size)}). Allocated 16 vCPUs, 64 GB RAM, and GPU accelerator for low-latency batch inferencing."
            technical_signals.append("Medium neural network parameter count")
        else:
            cpu = 8
            memory = 32
            priority = "medium"
            reasoning = f"Compact vision/NLP model weights ({format_file_size(file_size)}). Sized at 8 vCPUs and 32 GB RAM with dedicated GPU acceleration."
            technical_signals.append("Compact model architecture suitable for edge-cloud serving")

    # 3. Big Data / Tabular Datasets (.parquet, .csv, .arrow, .tsv)
    elif not leaf_diagnosis and (lower_name.endswith(('.parquet', '.arrow', '.csv', '.tsv')) or (archive_info and archive_info["has_data"])):
        workload_type = "Tabular / Big Data Pipeline"
        gpu = False
        priority = "high"
        if file_size > 100 * 1024 * 1024:
            cpu = 32
            memory = 128
            reasoning = f"High-volume tabular dataset ({format_file_size(file_size)}). Allocated 32 compute-optimized vCPUs and 128 GB memory for memory-mapped columnar data processing."
        else:
            cpu = 16
            memory = 64
            reasoning = f"Data processing workload ({format_file_size(file_size)}). Sized at 16 vCPUs and 64 GB RAM for parallel Pandas/Polars execution."
        technical_signals.append("Memory-intensive columnar execution profile")
        technical_signals.append("CPU-bound distributed processing; GPU disabled")

    # 4. Code Microservice (Python, Node, Docker, Compose, Go)
    elif not leaf_diagnosis and (lower_name.endswith(('.py', '.js', '.ts', '.go', '.java', 'dockerfile')) or (archive_info and (archive_info["has_docker"] or archive_info["code_count"] > 0))):
        workload_type = "Application / Microservice Code"
        cpu = 4
        memory = 16
        gpu = False
        priority = "medium"
        reasoning = f"Microservice application source code. Sized at 4 vCPUs and 16 GB RAM baseline for web API serving and background queues."
        technical_signals.append("Web / REST API compute profile")
        technical_signals.append("Low idle power with auto-scaling readiness")

    # 5. Infrastructure Manifest (YAML / JSON)
    elif not leaf_diagnosis and lower_name.endswith(('.yaml', '.yml', '.json')):
        workload_type = "Infrastructure Manifest"
        text_str = content.decode("utf-8", errors="ignore").lower()
        if "gpu" in text_str or "nvidia" in text_str:
            gpu = True
            technical_signals.append("Manifest specifies GPU accelerator requirement")
        if "high" in text_str or "production" in text_str:
            priority = "high"
        
        if "64gi" in text_str or "64gb" in text_str:
            memory = 64
            cpu = 16
        elif "128gi" in text_str or "128gb" in text_str:
            memory = 128
            cpu = 32
        elif "16gi" in text_str or "16gb" in text_str:
            memory = 16
            cpu = 4
        else:
            cpu = 8
            memory = 32
        reasoning = f"Parsed infrastructure manifest ({filename}). Extracted resource declarations and sizing constraints."

    # 6. Fallback Generic File
    elif not leaf_diagnosis:
        workload_type = "Custom Binary / Data Payload"
        if file_size > 200 * 1024 * 1024:
            cpu = 16
            memory = 64
            gpu = False
            priority = "high"
        else:
            cpu = 8
            memory = 32
            gpu = False
            priority = "medium"
        reasoning = f"Uploaded binary asset ({format_file_size(file_size)}). Scaled baseline cloud compute resources to ensure adequate processing headroom."
        technical_signals.append(f"Payload size: {format_file_size(file_size)}")

    return {
        "status": "success",
        "filename": filename,
        "file_size_bytes": file_size,
        "file_size_formatted": format_file_size(file_size),
        "workload_type": workload_type,
        "reasoning": reasoning,
        "technical_signals": technical_signals,
        "plant_disease_diagnosis": leaf_diagnosis,
        "recommended_resources": {
            "cpu": cpu,
            "memory": memory,
            "gpu": gpu,
            "priority": priority,
            "region": region
        }
    }
