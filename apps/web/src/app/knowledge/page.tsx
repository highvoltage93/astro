import { KnowledgeNotesPage } from "@/components/knowledge-notes";

export default function Page({ searchParams }: { searchParams: { source?: string; note?: string; seed?: string } }) {
  return <KnowledgeNotesPage key={JSON.stringify([searchParams.note, searchParams.source, searchParams.seed])} source={searchParams.source} noteId={searchParams.note} seed={searchParams.seed} />;
}
