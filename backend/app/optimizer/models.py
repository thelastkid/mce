from typing import Dict, Optional, Any, List
from pydantic import BaseModel, Field

class DeployRequest(BaseModel):
    application: str = Field(..., description="Target application name or manifest")
    cpu: int = Field(..., ge=1, le=64, description="Number of CPU cores")
    memory: int = Field(..., ge=2, le=256, description="RAM in GB")
    gpu: bool = Field(default=False, description="Whether GPU accelerator is required")
    region: str = Field(..., description="Target geographic region: India, US, Europe")
    priority: str = Field(default="medium", description="Priority level: low, medium, high")

class CostEstimate(BaseModel):
    estimated_cost: float = Field(..., description="Estimated cost in INR formatted for frontend")
    hourly_usd: Optional[float] = None
    monthly_usd: Optional[float] = None
    monthly_inr: Optional[float] = None
    instance_type: Optional[str] = None
    specs: Optional[Dict[str, Any]] = None

class CloudPlacementScore(BaseModel):
    cloud: str
    total_score: float
    cost_score: float
    performance_score: float
    latency_score: float
    compliance_score: float
    rank: int

class DeployResponse(BaseModel):
    status: str = Field(..., description="Deployment status message")
    selected_cloud: str = Field(..., description="Recommended cloud provider: AWS, Azure, or GCP")
    reason: str = Field(..., description="Transparent analytical rationale for the decision")
    cost_estimates: Dict[str, CostEstimate] = Field(..., description="Cost estimates for each provider")
    detailed_breakdown: Optional[Dict[str, Any]] = None

