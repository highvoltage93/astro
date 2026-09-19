import { ConsultationPrint } from "@/components/consultation-print";

export default function Page({ searchParams }: { searchParams: { id?: string; revision?: string } }) {
  return <ConsultationPrint key={`${searchParams.id ?? "none"}:${searchParams.revision ?? "latest"}`} id={searchParams.id} revision={searchParams.revision} />;
}
