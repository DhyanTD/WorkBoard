import { actorFromRequest, applicationResponse } from "@/server/design/http/routeSupport";
import { getDesignRuntime } from "@/server/design/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ designId: string }> },
) {
  const actor = actorFromRequest(request);
  const { designId } = await params;
  return applicationResponse(
    await getDesignRuntime().service.getDesignHead(actor, designId),
  );
}
