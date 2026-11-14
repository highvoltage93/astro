import { AdminObservations } from "@/components/admin-observations";

export default function Page({ searchParams }: { searchParams: { authorId?: string } }) {
  return <AdminObservations key={searchParams.authorId || "all"} authorId={searchParams.authorId} />;
}
