"""
Deployment Optimizer API Router
Handles multi-cloud placement requests. Matches the exact contract expected by CloudOptix frontend.
"""

from fastapi import APIRouter, HTTPException, status
from ..optimizer.models import DeployRequest, DeployResponse
from ..optimizer.engine import optimize_placement

router = APIRouter(tags=["Multi-Cloud Deployment Optimizer"])

@router.post(
    "/deploy",
    response_model=DeployResponse,
    summary="Optimize & Place Cloud Workload",
    description="Evaluates cost, latency, region compliance, and SLA across AWS, Azure, and GCP."
)
async def deploy_endpoint(request: DeployRequest):
    try:
        return optimize_placement(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Placement optimization engine failed: {str(e)}"
        )

@router.post(
    "/api/deploy",
    response_model=DeployResponse,
    include_in_schema=False
)
async def api_deploy_endpoint(request: DeployRequest):
    return await deploy_endpoint(request)

