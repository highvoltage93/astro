import { AdminUserDetails } from "@/components/admin-user-details";
import { adminListFilters, adminListQuery } from "@/lib/admin-users";

export default function AdminUserPage({ params, searchParams }: {
  params: { id: string }; searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = adminListFilters({ get: (key) => typeof searchParams[key] === "string" ? searchParams[key] as string : null });
  const backHref = `/admin?${adminListQuery(filters.search, filters.roleFilter, filters.page)}`;
  return <AdminUserDetails key={params.id} userId={params.id} backHref={backHref} />;
}
