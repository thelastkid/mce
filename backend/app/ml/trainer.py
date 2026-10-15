"""
Plant Disease Model Trainer
Trains a machine learning classifier on apple leaf images:
Apple___Black_rot vs Apple___healthy.
"""

import os
import json
import joblib
import numpy as np
from PIL import Image, ImageFilter
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "dataset"))
SAVE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "saved_models"))
CLASSES = ["Apple___Black_rot", "Apple___healthy"]
DISPLAY_NAMES = {
    "Apple___Black_rot": "Apple Black Rot (Botryosphaeria obtusa)",
    "Apple___healthy": "Apple Healthy (Normal Leaf)"
}

def extract_image_features(img: Image.Image) -> np.ndarray:
    """Extract 879 visual features from an apple leaf image."""
    img_rgb = img.convert("RGB").resize((128, 128))
    img_hsv = img_rgb.convert("HSV")
    
    arr_rgb = np.array(img_rgb, dtype=np.float32) / 255.0
    arr_hsv = np.array(img_hsv, dtype=np.float32) / 255.0
    
    # 1. Color moments (RGB + HSV)
    rgb_means = arr_rgb.mean(axis=(0, 1))
    rgb_stds = arr_rgb.std(axis=(0, 1))
    hsv_means = arr_hsv.mean(axis=(0, 1))
    hsv_stds = arr_hsv.std(axis=(0, 1))
    
    # 2. Channel Histograms (16 bins each)
    h_hist, _ = np.histogram(arr_hsv[:, :, 0], bins=16, range=(0, 1), density=True)
    s_hist, _ = np.histogram(arr_hsv[:, :, 1], bins=16, range=(0, 1), density=True)
    v_hist, _ = np.histogram(arr_hsv[:, :, 2], bins=16, range=(0, 1), density=True)
    r_hist, _ = np.histogram(arr_rgb[:, :, 0], bins=16, range=(0, 1), density=True)
    g_hist, _ = np.histogram(arr_rgb[:, :, 1], bins=16, range=(0, 1), density=True)
    b_hist, _ = np.histogram(arr_rgb[:, :, 2], bins=16, range=(0, 1), density=True)
    
    # 3. Spatial thumbnail (16x16 grid = 768 values)
    thumb_rgb = np.array(img_rgb.resize((16, 16)), dtype=np.float32).flatten() / 255.0
    
    # 4. Edge and gradient texture features
    gray = img_rgb.convert("L")
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edge_arr = np.array(edges, dtype=np.float32) / 255.0
    edge_features = np.array([edge_arr.mean(), edge_arr.std(), float(np.percentile(edge_arr, 90))])
    
    return np.concatenate([
        rgb_means, rgb_stds, hsv_means, hsv_stds,
        h_hist, s_hist, v_hist, r_hist, g_hist, b_hist,
        thumb_rgb,
        edge_features
    ])

def train_and_save():
    os.makedirs(SAVE_DIR, exist_ok=True)
    print(f"Loading dataset from: {DATA_DIR}")
    
    X, y, sample_paths = [], [], []
    class_counts = {}
    
    for label_idx, class_name in enumerate(CLASSES):
        class_folder = os.path.join(DATA_DIR, class_name)
        if not os.path.isdir(class_folder):
            raise FileNotFoundError(f"Folder not found: {class_folder}")
        
        files = [f for f in os.listdir(class_folder) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
        class_counts[class_name] = len(files)
        print(f"Class '{class_name}': {len(files)} images")
        
        for f in files:
            full_p = os.path.join(class_folder, f)
            with Image.open(full_p) as img:
                feat = extract_image_features(img)
                X.append(feat)
                y.append(label_idx)
                sample_paths.append(full_p)
                
    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.int32)
    
    print(f"Dataset compiled: {len(X)} total samples with {X.shape[1]} features each.")
    
    # 5-fold Stratified Cross Validation
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    clf = HistGradientBoostingClassifier(random_state=42, max_iter=200, l2_regularization=0.1)
    
    cv_scores = cross_val_score(clf, X, y, cv=cv, scoring="accuracy")
    print(f"5-Fold Cross Validation Accuracy: {cv_scores.mean() * 100:.2f}% (+/- {cv_scores.std() * 100:.2f}%)")
    
    # Train full model
    clf.fit(X, y)
    train_preds = clf.predict(X)
    train_acc = accuracy_score(y, train_preds)
    cm = confusion_matrix(y, train_preds).tolist()
    
    # Save model
    model_path = os.path.join(SAVE_DIR, "plant_disease_model.joblib")
    joblib.dump(clf, model_path)
    print(f"Model saved to: {model_path}")
    
    # Save metadata
    metadata = {
        "model_name": "Apple Disease Vision Classifier (HistGradientBoosting)",
        "framework": "Scikit-learn + Pillow Vision Pipeline",
        "classes": CLASSES,
        "class_display_names": DISPLAY_NAMES,
        "num_features": int(X.shape[1]),
        "total_samples": int(len(X)),
        "class_distribution": class_counts,
        "cv_accuracy": float(round(float(cv_scores.mean() * 100), 2)),
        "cv_std": float(round(float(cv_scores.std() * 100), 2)),
        "training_accuracy": float(round(float(train_acc * 100), 2)),
        "confusion_matrix": cm,
        "feature_types": [
            "RGB Moments (6)",
            "HSV Moments (6)",
            "Color Histograms (96)",
            "Spatial Grid Distribution (768)",
            "Texture & Edge Moments (3)"
        ]
    }
    
    meta_path = os.path.join(SAVE_DIR, "model_metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"Metadata saved to: {meta_path}")

if __name__ == "__main__":
    train_and_save()

