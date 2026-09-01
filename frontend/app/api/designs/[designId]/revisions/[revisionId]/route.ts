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
  const actor = actorFromRequest(request);
  const { designId, revisionId } = await params;
  return applicationResponse(
    await getDesignRuntime().service.getSnapshot(actor, designId, revisionId),
  );
}
