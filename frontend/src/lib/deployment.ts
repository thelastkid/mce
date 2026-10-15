import { z } from "zod";

const deploymentEndpoint =
  import.meta.env.VITE_DEPLOYMENT_API_URL ?? "/deploy";

export const deploymentRequest = z.object({
  application: z.string().trim().min(1),
  cpu: z.number().int().min(1).max(64),
  memory: z.number().int().min(2).max(256),
  gpu: z.boolean(),
  region: z.enum(["India", "US", "Europe"]),
  priority: z.enum(["low", "medium", "high"]),
});

export type DeploymentPayload = z.infer<typeof deploymentRequest>;

/**
 * Direct client fetch function connecting directly to the CloudOptix FastAPI backend.
 */
export async function deployWorkload({ data }: { data: DeploymentPayload }) {
  const validated = deploymentRequest.parse(data);
  let response: Response;

  try {
    response = await fetch(deploymentEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validated),
    });
  } catch (error) {
    throw new Error(
      "The deployment estimation API could not be reached. Ensure the backend server is running on port 8000.",
    );
  }

  const body = (await response.json().catch(() => null)) as {
    detail?: string;
    reason?: string;
    status?: string;
    selected_cloud?: string;
    cost_estimates?: Record<string, { estimated_cost: number }>;
  } | null;

  if (!response.ok) {
    throw new Error(
      body?.detail ?? body?.reason ?? `Request failed with status ${response.status}`,
    );
  }

  return body;
}
