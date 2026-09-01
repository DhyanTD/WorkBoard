import { saveDraftRequestSchema } from "@/server/design/http/schemas";
import {
  actorFromRequest,
  applicationResponse,
  parseJsonBody,
} from "@/server/design/http/routeSupport";
import { getDesignRuntime } from "@/server/design/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ designId: string }> },
) {
  const actor = actorFromRequest(request);
  const body = await parseJsonBody(request, actor, saveDraftRequestSchema);
  if (!body.ok) return applicationResponse(body.failure);
  const { designId } = await params;
  return applicationResponse(
    await getDesignRuntime().service.saveDraft(
      actor,
      designId,
      body.data.document,
      body.data.expectedRevisionId,
    ),
  );
}
