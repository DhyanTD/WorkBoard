import { actorFromRequest, applicationResponse } from "@/server/design/http/routeSupport";
import { getDesignRuntime } from "@/server/design/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  {
    params,
  }: { params: Promise<{ designId: string; revisionId: string }> },
) {
  const runtime = await getDesignRuntime();
  const resolved = await actorFromRequest(request, runtime.actorDirectory);
  if (!resolved.ok) return applicationResponse(resolved.failure);
  const { designId, revisionId } = await params;
  return applicationResponse(
    await runtime.service.getSnapshot(resolved.actor, designId, revisionId),
  );
}
