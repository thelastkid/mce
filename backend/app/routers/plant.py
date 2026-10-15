"""
Plant Disease API Router
Provides image diagnosis, sample images, and model metadata for plant-api.
"""

import base64
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from pydantic import BaseModel
from ..ml.model import predict_leaf_image, get_model_info, CLASSES
from ..ml.sample_provider import get_sample_images

router = APIRouter(prefix="/api/plant", tags=["Plant Disease ML Service (plant-api)"])

class Base64PredictRequest(BaseModel):
    image_base64: str

@router.post(
    "/predict",
    summary="Diagnose Apple Leaf Image (File Upload)",
    description="Upload an image file (JPEG/PNG) of an apple leaf to diagnose Black Rot vs Healthy."
)
async def predict_leaf_upload(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File provided must be an image (JPEG, PNG, etc.)."
        )
    contents = await file.read()
    try:
        result = predict_leaf_image(contents)
        result["filename"] = file.filename
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Inference failed on provided image: {str(e)}"
        )

@router.post(
    "/predict-base64",
    summary="Diagnose Apple Leaf Image (Base64)",
    description="Provide base64 encoded image string (or data URI) to diagnose."
)
async def predict_leaf_b64(req: Base64PredictRequest):
    data_str = req.image_base64
    if "," in data_str:
        data_str = data_str.split(",", 1)[1]
    try:
        image_bytes = base64.b64decode(data_str)
        result = predict_leaf_image(image_bytes)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to decode or process base64 image: {str(e)}"
        )

@router.get(
    "/samples",
    summary="Get Pre-loaded Sample Images",
    description="Returns sample leaf images from dataset with base64 data URLs for one-click testing."
)
async def list_sample_images():
    return {"samples": get_sample_images(samples_per_class=3)}

@router.get(
    "/model-info",
    summary="Get Plant Disease Model Metadata",
    description="Returns model architecture, accuracy, cross-validation metrics, and dataset statistics."
)
async def model_info():
    return get_model_info()

@router.get(
    "/classes",
    summary="List Supported Classes",
    description="Returns classes supported by the trained computer vision model."
)
async def list_classes():
    return {"classes": CLASSES}

