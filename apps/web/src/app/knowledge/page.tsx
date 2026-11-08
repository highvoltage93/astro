import { KnowledgeNotesPage } from "@/components/knowledge-notes";

export default function Page({ searchParams }: { searchParams: { source?: string; note?: string } }) {
  return <KnowledgeNotesPage key={searchParams.note ?? searchParams.source ?? "library"} source={searchParams.source} noteId={searchParams.note} />;
}
