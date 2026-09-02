import { actorFromRequest, applicationResponse } from "@/server/design/http/routeSupport";
import { getDesignRuntime } from "@/server/design/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ designId: string }> },
) {
  const runtime = await getDesignRuntime();
  const resolved = await actorFromRequest(request, runtime.actorDirectory);
  if (!resolved.ok) return applicationResponse(resolved.failure);
  const { designId } = await params;
  return applicationResponse(
    await runtime.service.getDesignHead(resolved.actor, designId),
  );
}
