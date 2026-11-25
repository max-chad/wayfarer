import { ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { consumerPlan, quotaStatus, quotaSubject } from "@/lib/data/billing";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  const plan = consumerPlan(user);
  const subject = quotaSubject(req, user);
  return ok({ plan, quotas: { plan: quotaStatus(subject, plan, "plan"), chat: quotaStatus(subject, plan, "chat") } }, { headers: { "cache-control": "no-store" } });
}
