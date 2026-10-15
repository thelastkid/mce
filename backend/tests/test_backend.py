import os
import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_root():
    response = client.get("/api-info")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    assert "modules" in data

def test_deploy_optimizer():
    payload = {
        "application": "plant-api",
        "cpu": 8,
        "memory": 32,
        "gpu": False,
        "region": "India",
        "priority": "medium"
    }
    response = client.post("/deploy", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "selected_cloud" in data
    assert data["selected_cloud"] in ["AWS", "Azure", "GCP"]
    assert "cost_estimates" in data
    assert "AWS" in data["cost_estimates"]
    assert "Azure" in data["cost_estimates"]
    assert "GCP" in data["cost_estimates"]
    assert data["cost_estimates"]["AWS"]["estimated_cost"] > 0
    assert "reason" in data
    assert len(data["reason"]) > 10

def test_deploy_with_gpu_high_priority():
    payload = {
        "application": "nlp-inference-service",
        "cpu": 16,
        "memory": 64,
        "gpu": True,
        "region": "US",
        "priority": "high"
    }
    response = client.post("/deploy", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["selected_cloud"] in ["AWS", "Azure", "GCP"]
    assert data["cost_estimates"]["AWS"]["specs"]["GPU"] != "None"

def test_analyze_file_endpoint():
    # Test uploading a model weight file
    fake_model = io.BytesIO(b"PK\x03\x04fake_model_data_and_weights" * 1000)
    response = client.post(
        "/api/workloads/analyze-file",
        files={"file": ("vision_transformer.pth", fake_model, "application/octet-stream")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["recommended_resources"]["gpu"] is True
    assert data["recommended_resources"]["cpu"] >= 8
    assert data["recommended_resources"]["memory"] >= 32

def test_realtime_prices_endpoint():
    response = client.get("/api/analytics/realtime-prices")
    assert response.status_code == 200
    data = response.json()
    assert "providers" in data
    assert "AWS" in data["providers"]
    assert "Azure" in data["providers"]
    assert "GCP" in data["providers"]
    assert data["providers"]["AWS"]["hourly_base_inr"] > 0

def test_plant_samples_endpoint():
    response = client.get("/api/plant/samples")
    assert response.status_code == 200
    samples = response.json()["samples"]
    assert len(samples) > 0
    assert "data_url" in samples[0]

def test_plant_model_info():
    response = client.get("/api/plant/model-info")
    assert response.status_code == 200
    info = response.json()
    assert "classes" in info
    assert "Apple___Black_rot" in info["classes"]
    assert info["training_accuracy"] >= 95.0

def test_plant_prediction_on_real_samples():
    samples_resp = client.get("/api/plant/samples")
    assert samples_resp.status_code == 200
    samples = samples_resp.json()["samples"]
    assert len(samples) > 0
    
    b64_req = {"image_base64": samples[0]["data_url"]}
    pred_resp = client.post("/api/plant/predict-base64", json=b64_req)
    assert pred_resp.status_code == 200
    pred = pred_resp.json()
    assert pred["status"] == "success"
    assert pred["predicted_class"] in ["Apple___Black_rot", "Apple___healthy"]

def test_workloads_api():
    response = client.get("/api/workloads")
    assert response.status_code == 200
    workloads = response.json()["workloads"]
    assert any(w["id"] == "plant-api" for w in workloads)

def test_trends_api():
    response = client.get("/api/analytics/trends")
    assert response.status_code == 200
    trends = response.json()
    assert "series" in trends
    assert "AWS" in trends["series"]
    # Check that it has historical, current, and forecast stages
    stages = [item["stage"] for item in trends["series"]["AWS"]]
    assert "historical" in stages
    assert "current" in stages
    assert "forecast" in stages
