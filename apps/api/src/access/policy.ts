export const defaultAccessSettings = { trialEnabled: true, trialDays: 7, revision: 0,
  enforcementEnabled: false, transitionDays: 14, launchedAt: null };
export type Grant = { plan: "TRIAL" | "PRO"; startsAt: Date; endsAt: Date; revokedAt: Date | null };
export type Feature = "natal" | "archive" | "forecast" | "consultation" | "ownObservations" | "sharedObservations" | "profiles";
export const features: Feature[] = ["natal", "archive", "forecast", "consultation", "ownObservations", "sharedObservations", "profiles"];

export function accessDecision(role: string, grants: Grant[], now = new Date(), enforcementEnabled = false) {
  const active = grants.filter((grant) => !grant.revokedAt && grant.startsAt <= now && now < grant.endsAt);
  const plan = active.some((grant) => grant.plan === "PRO") ? "PRO" : active.length ? "TRIAL" : "FREE";
  const endsAt = active.filter((grant) => grant.plan === plan)
    .reduce<Date | null>((last, grant) => !last || grant.endsAt > last ? grant.endsAt : last, null);
  const canWork = !enforcementEnabled || role === "ADMIN" || plan !== "FREE";
  const proposed = Object.fromEntries(features.map((feature) => [feature,
    feature === "archive" || canWork])) as Record<Feature, boolean>;
  return { plan, endsAt, administrator: role === "ADMIN", mode: enforcementEnabled ? "enforced" as const : "preview" as const,
    canWork, proposed };
}

export const trialEnd = (start: Date, days: number) => new Date(start.getTime() + days * 86400000);
