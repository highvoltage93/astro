import { KnowledgeLibrary } from "@/components/knowledge-library";

export default function Page({ searchParams }: { searchParams: { view?: string; note?: string; authorId?: string; authorName?: string } }) {
  return <KnowledgeLibrary key={JSON.stringify([searchParams.view, searchParams.note, searchParams.authorId, searchParams.authorName])}
    activeOnly={searchParams.view === "active"} noteId={searchParams.note} authorId={searchParams.authorId} authorName={searchParams.authorName} />;
}
