import { createDesignRequestSchema } from "@/server/design/http/schemas";
import {
  actorFromRequest,
  applicationResponse,
  parseJsonBody,
} from "@/server/design/http/routeSupport";
import { getDesignRuntime } from "@/server/design/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = actorFromRequest(request);
  return applicationResponse(await getDesignRuntime().service.listDesigns(actor));
}

export async function POST(request: Request) {
  const actor = actorFromRequest(request);
  const body = await parseJsonBody(request, actor, createDesignRequestSchema);
  if (!body.ok) return applicationResponse(body.failure);
  return applicationResponse(
    await getDesignRuntime().service.createDesign(actor, body.data.document),
    201,
  );
}
