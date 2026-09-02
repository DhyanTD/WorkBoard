import { createDesignRequestSchema } from "@/server/design/http/schemas";
import {
  actorFromRequest,
  applicationResponse,
  parseJsonBody,
  writeOptionsFromRequest,
} from "@/server/design/http/routeSupport";
import { getDesignRuntime } from "@/server/design/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const runtime = await getDesignRuntime();
  const resolved = await actorFromRequest(request, runtime.actorDirectory);
  if (!resolved.ok) return applicationResponse(resolved.failure);
  return applicationResponse(await runtime.service.listDesigns(resolved.actor));
}

export async function POST(request: Request) {
  const runtime = await getDesignRuntime();
  const resolved = await actorFromRequest(request, runtime.actorDirectory);
  if (!resolved.ok) return applicationResponse(resolved.failure);
  const body = await parseJsonBody(request, resolved.actor, createDesignRequestSchema);
  if (!body.ok) return applicationResponse(body.failure);
  const writeOptions = writeOptionsFromRequest(request, resolved.actor);
  if (!writeOptions.ok) return applicationResponse(writeOptions.failure);
  return applicationResponse(
    await runtime.service.createDesign(
      resolved.actor,
      body.data.document,
      writeOptions.options,
    ),
    201,
  );
}
