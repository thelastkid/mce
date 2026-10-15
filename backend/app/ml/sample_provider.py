"""
Sample Image Provider
Provides sample images from the dataset (Apple Black Rot and Apple Healthy)
encoded as data URLs for fast testing in the UI and API clients.
"""

import os
import base64
from typing import List, Dict, Any

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "dataset"))

def get_sample_images(samples_per_class: int = 2) -> List[Dict[str, Any]]:
    samples = []
    classes = ["Apple___Black_rot", "Apple___healthy"]
    
    for c in classes:
        c_dir = os.path.join(DATA_DIR, c)
        if not os.path.exists(c_dir):
            continue
        files = [f for f in os.listdir(c_dir) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
        for f in files[:samples_per_class]:
            f_path = os.path.join(c_dir, f)
            with open(f_path, "rb") as img_file:
                b64_data = base64.b64encode(img_file.read()).decode("utf-8")
                samples.append({
                    "id": f,
                    "filename": f,
                    "class": c,
                    "label": "Apple Black Rot (Diseased)" if "Black_rot" in c else "Apple Healthy (Normal)",
                    "data_url": f"data:image/jpeg;base64,{b64_data}"
                })
    return samples

