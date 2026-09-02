import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export async function GET() {
  redirect(await getSignInUrl({ returnTo: "/designs/workbench" }));
}
