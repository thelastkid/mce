"""
Multi-Cloud Infrastructure Optimizer & ML Inference Backend
FastAPI unified application serving both REST APIs and the compiled frontend application.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .routers import deploy, plant, workloads, analytics, documents
from .ml.model import load_model

DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Pre-loading Plant Disease ML Model...")
    load_model()
    print("Plant Disease ML Model successfully initialized!")
    yield

app = FastAPI(
    title="Multi-Cloud Infrastructure Optimizer & MLOps Control Plane",
    description=(
        "Unified Multi-Cloud infrastructure placement & cost estimation engine "
        "(AWS, Azure, GCP) with real-time cloud pricing feeds, ML workload analyzer, and frontend dashboard."
    ),
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(deploy.router)
app.include_router(plant.router)
app.include_router(workloads.router)
app.include_router(analytics.router)
app.include_router(documents.router)

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": "Multi-Cloud Infrastructure Optimizer"}

@app.get("/api-info", tags=["Health"])
async def api_info():
    return {
        "service": "Multi-Cloud Infrastructure Optimizer & MLOps Control Plane",
        "version": "1.0.0",
        "status": "operational",
        "docs_url": "/docs",
        "modules": {
            "optimizer": "/deploy",
            "realtime_pricing": "/api/analytics/realtime-prices",
            "pricing_trends": "/api/analytics/trends",
            "file_analyzer": "/api/workloads/analyze-file",
            "plant_disease_model": "/api/plant/predict",
            "sample_images": "/api/plant/samples"
        }
    }

# Mount static frontend assets if available
if os.path.isdir(DIST_DIR):
    assets_dir = os.path.join(DIST_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False)
    async def serve_index():
        index_file = os.path.join(DIST_DIR, "index.html")
        return FileResponse(index_file)

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa_fallback(full_path: str):
        # Serve exact file if exists
        file_path = os.path.join(DIST_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise SPA fallback to index.html
        return FileResponse(os.path.join(DIST_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
