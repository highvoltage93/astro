import type { ReactNode } from "react";
import { richDocumentSchema } from "@astroprocessor/consultation-format";
import type { RichDocument, RichNode } from "@astroprocessor/consultation-format";

function renderNode(node: RichNode, key: string): ReactNode {
  const children = node.content?.map((child, index) => renderNode(child, `${key}-${index}`));
  if (node.type === "text") {
    let text: ReactNode = node.text;
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") text = <strong>{text}</strong>;
      if (mark.type === "italic") text = <em>{text}</em>;
      if (mark.type === "underline") text = <u>{text}</u>;
      if (mark.type === "strike") text = <s>{text}</s>;
    }
    return <span key={key}>{text}</span>;
  }
  switch (node.type) {
    case "hardBreak": return <br key={key} />;
    case "paragraph": return <p key={key}>{children?.length ? children : <br />}</p>;
    case "heading": return node.attrs?.level === 3 ? <h3 key={key}>{children}</h3> : <h2 key={key}>{children}</h2>;
    case "blockquote": return <blockquote key={key}>{children}</blockquote>;
    case "bulletList": return <ul key={key}>{children}</ul>;
    case "orderedList": return <ol key={key} start={node.attrs?.start ?? 1} type={node.attrs?.type ?? "1"}>{children}</ol>;
    case "listItem": return <li key={key}>{children}</li>;
    default: return <div key={key}>{children}</div>;
  }
}

export function ConsultationRichPreview({ body }: { body: string | RichDocument }) {
  if (typeof body === "string") return <p className="whitespace-pre-wrap break-words text-sm leading-7">{body}</p>;
  const parsed = richDocumentSchema.safeParse(body);
  if (!parsed.success) return <p role="alert" className="text-sm text-destructive">Непідтримуваний формат тексту.</p>;
  return <div className="consultation-prose">{parsed.data.content.map((node, index) => renderNode(node, String(index)))}</div>;
}
