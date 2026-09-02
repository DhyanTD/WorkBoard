import {
  authkit,
  handleAuthkitHeaders,
} from "@workos-inc/authkit-nextjs";
import { type NextRequest, NextResponse } from "next/server";

const developmentAuthEnabled = () =>
  process.env.OPEN_WORKBOARD_DEV_AUTH === "true" ||
  process.env.NODE_ENV === "development";

export default async function proxy(request: NextRequest) {
  if (developmentAuthEnabled()) return NextResponse.next();
  const { session, headers, authorizationUrl } = await authkit(request);
  if (
    request.nextUrl.pathname.startsWith("/designs") &&
    !session.user &&
    authorizationUrl
  ) {
    return handleAuthkitHeaders(request, headers, { redirect: authorizationUrl });
  }
  return handleAuthkitHeaders(request, headers);
}

export const config = {
  matcher: ["/designs/:path*", "/api/designs/:path*"],
};
