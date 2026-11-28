import { ClientsPage } from "@/components/clients-page";

export default function Page({ params }: { params: { id: string } }) {
  return <ClientsPage key={params.id} clientId={params.id} />;
}
