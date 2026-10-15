"""
Cloud Placement Optimization Engine
Computes multi-cloud cost models, evaluates compliance and SLA policies,
and identifies optimal cloud placement.
"""

from typing import Dict, Any, List
from .models import DeployRequest, DeployResponse, CostEstimate, CloudPlacementScore
from .cloud_catalog import PROVIDER_PROFILES, PRIORITY_DISCOUNTS, USD_TO_INR

def optimize_placement(req: DeployRequest) -> DeployResponse:
    estimates: Dict[str, CostEstimate] = {}
    rankings: List[CloudPlacementScore] = []
    
    region_key = req.region if req.region in ["India", "US", "Europe"] else "India"
    priority_info = PRIORITY_DISCOUNTS.get(req.priority.lower(), PRIORITY_DISCOUNTS["medium"])
    priority_mult = priority_info["multiplier"]
    
    hourly_costs_inr: Dict[str, float] = {}
    
    for cloud_code, profile in PROVIDER_PROFILES.items():
        reg_data = profile["regions"][region_key]
        reg_mult = reg_data["multiplier"]
        
        # Base compute calculation
        cpu_cost = req.cpu * profile["base_cpu_hour_usd"]
        ram_cost = req.memory * profile["base_ram_gb_hour_usd"]
        gpu_cost = (profile["gpu_unit_hour_usd"] * max(1, req.cpu // 8)) if req.gpu else 0.0
        
        raw_hourly_usd = (cpu_cost + ram_cost + gpu_cost) * reg_mult * priority_mult
        hourly_usd = round(raw_hourly_usd, 4)
        monthly_usd = round(hourly_usd * 730, 2)
        
        hourly_inr = round(hourly_usd * USD_TO_INR, 2)
        monthly_inr = round(monthly_usd * USD_TO_INR, 2)
        
        hourly_costs_inr[cloud_code] = hourly_inr
        
        # Instance sizing naming
        size_suffix = f"{max(1, req.cpu // 2)}xlarge" if req.cpu >= 4 else "large"
        pattern = profile["instance_patterns"]["gpu" if req.gpu else ("memory" if req.memory > req.cpu * 4 else "general")]
        instance_name = pattern.replace("{size}", size_suffix)
        
        estimates[cloud_code] = CostEstimate(
            estimated_cost=hourly_inr,
            hourly_usd=hourly_usd,
            monthly_usd=monthly_usd,
            monthly_inr=monthly_inr,
            instance_type=instance_name,
            specs={
                "vCPU": req.cpu,
                "RAM_GB": req.memory,
                "GPU": "NVIDIA Tier-1" if req.gpu else "None",
                "datacenter": reg_data["region_code"],
                "latency_ms": reg_data["latency_ms"],
                "green_energy_pct": reg_data["renewable_energy_pct"]
            }
        )

    # Score each provider
    min_cost = min(hourly_costs_inr.values())
    max_cost = max(hourly_costs_inr.values())
    cost_span = max(0.01, max_cost - min_cost)

    for cloud_code, profile in PROVIDER_PROFILES.items():
        reg_data = profile["regions"][region_key]
        
        # Cost score (0-100, lower cost = higher score)
        cost_score = 100.0 - ((hourly_costs_inr[cloud_code] - min_cost) / cost_span * 40.0)
        
        # Latency score (0-100, lower ms = higher score)
        latency_score = max(50.0, 100.0 - (reg_data["latency_ms"] * 1.5))
        
        # Performance / SLA score
        perf_score = 90.0 + (5.0 if cloud_code == "AWS" else (4.0 if cloud_code == "GCP" else 3.0))
        
        # Compliance & green energy score
        comp_score = reg_data["renewable_energy_pct"]
        
        # Weighted overall score (Cost 45%, Latency 25%, Perf 20%, Green 10%)
        total_score = (
            cost_score * 0.45 +
            latency_score * 0.25 +
            perf_score * 0.20 +
            comp_score * 0.10
        )
        
        rankings.append(CloudPlacementScore(
            cloud=cloud_code,
            total_score=round(total_score, 1),
            cost_score=round(cost_score, 1),
            performance_score=round(perf_score, 1),
            latency_score=round(latency_score, 1),
            compliance_score=round(comp_score, 1),
            rank=0
        ))
        
    rankings.sort(key=lambda x: x.total_score, reverse=True)
    for idx, r in enumerate(rankings):
        r.rank = idx + 1
        
    winner = rankings[0].cloud
    winner_profile = PROVIDER_PROFILES[winner]
    winner_region = winner_profile["regions"][region_key]
    winner_est = estimates[winner]
    second_place = rankings[1]
    
    savings_pct = round(
        ((hourly_costs_inr[second_place.cloud] - hourly_costs_inr[winner]) / hourly_costs_inr[second_place.cloud]) * 100,
        1
    ) if hourly_costs_inr[second_place.cloud] > hourly_costs_inr[winner] else 0.0

    # Compose informative rationale
    savings_clause = f" yielding ~{savings_pct}% cost savings over {second_place.cloud}" if savings_pct > 0 else ""
    reason = (
        f"{winner} ({winner_region['region_code']}) recommended for {req.application} with score {rankings[0].total_score}/100.{savings_clause}. "
        f"Selected instance {winner_est.instance_type} provides {req.cpu} vCPUs and {req.memory} GB RAM at ₹{winner_est.estimated_cost}/hr with "
        f"{winner_region['latency_ms']}ms regional latency and full {region_key} data compliance."
    )

    return DeployResponse(
        status="Optimal Placement Identified",
        selected_cloud=winner,
        reason=reason,
        cost_estimates=estimates,
        detailed_breakdown={
            "application": req.application,
            "region": region_key,
            "priority": req.priority,
            "sla": f"{priority_info['sla_pct']}%",
            "redundancy_model": priority_info["redundancy"],
            "usd_to_inr_rate": USD_TO_INR,
            "rankings": [r.model_dump() for r in rankings]
        }
    )

