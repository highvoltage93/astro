import { ConsultationPage } from "@/components/consultation-page";

export default function Page({ searchParams }: { searchParams: { id?: string } }) {
  return <ConsultationPage key={searchParams.id ?? "list"} id={searchParams.id} />;
}
