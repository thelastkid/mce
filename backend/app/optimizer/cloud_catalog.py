"""
Cloud Catalog & Pricing Matrix
Defines cloud providers (AWS, Azure, GCP), regional rates, instance mappings,
and policy parameters for multi-cloud placement.
"""

from typing import Dict, Any

# Current approximate USD to INR conversion rate
USD_TO_INR = 86.50

# Base hourly rates in USD per core, per GB RAM, and per GPU unit
PROVIDER_PROFILES: Dict[str, Dict[str, Any]] = {
    "AWS": {
        "name": "Amazon Web Services",
        "portal_url": "https://aws.amazon.com/",
        "base_cpu_hour_usd": 0.040,      # ~$0.040 per vCPU hour (e.g. c6i/m6i baseline)
        "base_ram_gb_hour_usd": 0.0053,   # ~$0.0053 per GB RAM hour
        "gpu_unit_hour_usd": 0.526,      # NVIDIA T4/A10G entry tier
        "regions": {
            "India": {
                "region_code": "ap-south-1 (Mumbai)",
                "multiplier": 1.05,
                "latency_ms": 18,
                "gpu_available": True,
                "renewable_energy_pct": 78,
                "compliance": ["DPDP", "ISO27001", "SOC2"]
            },
            "US": {
                "region_code": "us-east-1 (N. Virginia)",
                "multiplier": 1.00,
                "latency_ms": 12,
                "gpu_available": True,
                "renewable_energy_pct": 88,
                "compliance": ["HIPAA", "SOC2", "FedRAMP"]
            },
            "Europe": {
                "region_code": "eu-central-1 (Frankfurt)",
                "multiplier": 1.08,
                "latency_ms": 15,
                "gpu_available": True,
                "renewable_energy_pct": 94,
                "compliance": ["GDPR", "BSI C5", "ISO27001"]
            }
        },
        "instance_patterns": {
            "gpu": "g4dn.{size} / g5.{size}",
            "high_cpu": "c6i.{size}",
            "general": "m6i.{size}",
            "memory": "r6i.{size}"
        }
    },
    "Azure": {
        "name": "Microsoft Azure",
        "portal_url": "https://azure.microsoft.com/",
        "base_cpu_hour_usd": 0.043,
        "base_ram_gb_hour_usd": 0.0056,
        "gpu_unit_hour_usd": 0.540,
        "regions": {
            "India": {
                "region_code": "centralindia (Pune)",
                "multiplier": 1.07,
                "latency_ms": 25,
                "gpu_available": True,
                "renewable_energy_pct": 74,
                "compliance": ["DPDP", "ISO27001", "SOC2", "MeitY"]
            },
            "US": {
                "region_code": "eastus (Virginia)",
                "multiplier": 1.01,
                "latency_ms": 14,
                "gpu_available": True,
                "renewable_energy_pct": 85,
                "compliance": ["HIPAA", "SOC2", "FedRAMP High"]
            },
            "Europe": {
                "region_code": "westeurope (Amsterdam)",
                "multiplier": 1.06,
                "latency_ms": 14,
                "gpu_available": True,
                "renewable_energy_pct": 98,
                "compliance": ["GDPR", "EU Model Clauses", "ISO27001"]
            }
        },
        "instance_patterns": {
            "gpu": "Standard_NC{size}_v3",
            "high_cpu": "Standard_F{size}s_v2",
            "general": "Standard_D{size}s_v5",
            "memory": "Standard_E{size}s_v5"
        }
    },
    "GCP": {
        "name": "Google Cloud Platform",
        "portal_url": "https://cloud.google.com/",
        "base_cpu_hour_usd": 0.0385,
        "base_ram_gb_hour_usd": 0.0051,
        "gpu_unit_hour_usd": 0.495,
        "regions": {
            "India": {
                "region_code": "asia-south1 (Mumbai)",
                "multiplier": 1.04,
                "latency_ms": 20,
                "gpu_available": True,
                "renewable_energy_pct": 82,
                "compliance": ["DPDP", "ISO27001", "SOC2"]
            },
            "US": {
                "region_code": "us-central1 (Iowa)",
                "multiplier": 0.98,
                "latency_ms": 11,
                "gpu_available": True,
                "renewable_energy_pct": 100,
                "compliance": ["HIPAA", "SOC2", "FedRAMP"]
            },
            "Europe": {
                "region_code": "europe-west3 (Frankfurt)",
                "multiplier": 1.05,
                "latency_ms": 16,
                "gpu_available": True,
                "renewable_energy_pct": 92,
                "compliance": ["GDPR", "C5", "ISO27001"]
            }
        },
        "instance_patterns": {
            "gpu": "g2-standard-{size} / a2",
            "high_cpu": "c2-standard-{size}",
            "general": "n2-standard-{size}",
            "memory": "n2-highmem-{size}"
        }
    }
}

PRIORITY_DISCOUNTS: Dict[str, Dict[str, Any]] = {
    "low": {
        "multiplier": 0.35,  # ~65% spot/preemptible discount
        "sla_pct": 99.5,
        "redundancy": "Single instance / Spot ephemeral"
    },
    "medium": {
        "multiplier": 1.00,  # Standard on-demand
        "sla_pct": 99.95,
        "redundancy": "Standard On-Demand instance"
    },
    "high": {
        "multiplier": 1.30,  # Reserved multi-AZ high availability
        "sla_pct": 99.99,
        "redundancy": "Multi-AZ Active/Standby with automated failover"
    }
}

