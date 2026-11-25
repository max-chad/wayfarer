import { requireUser } from "@/lib/api";
import { exportUserData } from "@/lib/data/account";

/** Downloads everything Wayfarer holds about the signed-in user as JSON. */
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const data = exportUserData(auth.user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="wayfarer-data-${auth.user.username}.json"`,
      "cache-control": "no-store",
    },
  });
}
