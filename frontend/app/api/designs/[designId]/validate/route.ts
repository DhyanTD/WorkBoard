import { validateOperationsRequestSchema } from "@/server/design/http/schemas";
import {
  actorFromRequest,
  applicationResponse,
  parseJsonBody,
} from "@/server/design/http/routeSupport";
import { getDesignRuntime } from "@/server/design/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ designId: string }> },
) {
  const runtime = await getDesignRuntime();
  const resolved = await actorFromRequest(request, runtime.actorDirectory);
  if (!resolved.ok) return applicationResponse(resolved.failure);
  const body = await parseJsonBody(
    request,
    resolved.actor,
    validateOperationsRequestSchema,
  );
  if (!body.ok) return applicationResponse(body.failure);
  const { designId } = await params;
  return applicationResponse(
    await runtime.service.validateOperations(
      resolved.actor,
      designId,
      body.data.operations,
    ),
  );
}
