import { handleAuth } from "@workos-inc/authkit-nextjs";

export const runtime = "nodejs";

export const GET = handleAuth({ returnPathname: "/designs/workbench" });
