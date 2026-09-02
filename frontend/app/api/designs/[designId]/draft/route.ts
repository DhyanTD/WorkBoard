import { saveDraftRequestSchema } from "@/server/design/http/schemas";
import {
  actorFromRequest,
  applicationResponse,
  parseJsonBody,
  writeOptionsFromRequest,
} from "@/server/design/http/routeSupport";
import { getDesignRuntime } from "@/server/design/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ designId: string }> },
) {
  const runtime = await getDesignRuntime();
  const resolved = await actorFromRequest(request, runtime.actorDirectory);
  if (!resolved.ok) return applicationResponse(resolved.failure);
  const body = await parseJsonBody(request, resolved.actor, saveDraftRequestSchema);
  if (!body.ok) return applicationResponse(body.failure);
  const writeOptions = writeOptionsFromRequest(request, resolved.actor);
  if (!writeOptions.ok) return applicationResponse(writeOptions.failure);
  const { designId } = await params;
  return applicationResponse(
    await runtime.service.saveDraft(
      resolved.actor,
      designId,
      body.data.document,
      body.data.expectedRevisionId,
      writeOptions.options,
    ),
  );
}
