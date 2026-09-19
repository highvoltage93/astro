"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, Extension, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Plugin } from "@tiptap/pm/state";
import { Bold, Italic, Underline, Strikethrough, Heading2, Heading3, List, ListOrdered, Quote, Pilcrow, Undo2, Redo2, RemoveFormatting } from "lucide-react";
import { richBody, richDocumentSchema } from "@astroprocessor/consultation-format";
import type { RichDocument } from "@astroprocessor/consultation-format";
import { Button } from "@/components/ui/button";

export function ConsultationRichText({ value, disabled, label, onChange, canChange }: {
  value: string | RichDocument; disabled: boolean; label: string;
  onChange: (document: RichDocument) => void;
  canChange: (document: RichDocument) => boolean;
}) {
  const callbacks = useRef({ onChange, canChange });
  callbacks.current = { onChange, canChange };
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const limits = useMemo(() => Extension.create({
    name: "consultationLimits",
    addProseMirrorPlugins() {
      return [new Plugin({ filterTransaction: (transaction) => {
        if (!transaction.docChanged) return true;
        const result = richDocumentSchema.safeParse(transaction.doc.toJSON());
        const accepted = result.success && callbacks.current.canChange(result.data);
        queueMicrotask(() => { if (mounted.current) setError(accepted ? null : "Зміна перевищує ліміт тексту або вкладеності. Встав менший фрагмент чи скороти документ."); });
        return accepted;
      } })];
    }
  }), []);
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [StarterKit.configure({
      heading: { levels: [2, 3] }, link: false, code: false, codeBlock: false, horizontalRule: false, trailingNode: false
    }), limits],
    content: richBody(value),
    editable: !disabled,
    editorProps: { attributes: {
      class: "consultation-prose min-h-40 p-3 outline-none", role: "textbox", "aria-multiline": "true", "aria-label": label
    } },
    onUpdate: ({ editor: current }) => {
      const result = richDocumentSchema.safeParse(current.getJSON());
      if (result.success) callbacks.current.onChange(result.data);
    }
  });
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({ editorProps: { attributes: {
      class: "consultation-prose min-h-40 p-3 outline-none", role: "textbox", "aria-multiline": "true", "aria-label": label
    } } });
  }, [editor, label]);
  useEffect(() => {
    if (!editor) return;
    const next = richBody(value);
    if (!editor.state.doc.eq(editor.schema.nodeFromJSON(next))) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  const tools = editor ? [
    { label: "Жирний", icon: Bold, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { label: "Курсив", icon: Italic, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Підкреслення", icon: Underline, active: editor.isActive("underline"), run: () => editor.chain().focus().toggleUnderline().run() },
    { label: "Закреслення", icon: Strikethrough, active: editor.isActive("strike"), run: () => editor.chain().focus().toggleStrike().run() },
    { label: "Звичайний абзац", icon: Pilcrow, active: editor.isActive("paragraph"), run: () => editor.chain().focus().setParagraph().run() },
    { label: "Заголовок", icon: Heading2, active: editor.isActive("heading", { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Підзаголовок", icon: Heading3, active: editor.isActive("heading", { level: 3 }), run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "Маркований список", icon: List, active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Нумерований список", icon: ListOrdered, active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Цитата", icon: Quote, active: editor.isActive("blockquote"), run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: "Прибрати форматування", icon: RemoveFormatting, active: false, run: () => editor.chain().focus().unsetAllMarks().clearNodes().run() }
  ] : [];

  return <div className="min-w-0 rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
    <div role="group" aria-label={`Форматування: ${label}`} className="flex flex-wrap gap-1 border-b p-1">
      {tools.map(({ label: title, icon: Icon, active, run }) => <Button key={title} type="button" size="icon" className="h-8 w-8 shrink-0" variant={active ? "secondary" : "ghost"}
        title={title} aria-label={title} aria-pressed={active} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={run}><Icon className="h-4 w-4" /></Button>)}
      <Button size="icon" className="h-8 w-8" variant="ghost" title="Скасувати" aria-label="Скасувати" disabled={disabled || !editor?.can().undo()} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></Button>
      <Button size="icon" className="h-8 w-8" variant="ghost" title="Повторити" aria-label="Повторити" disabled={disabled || !editor?.can().redo()} onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></Button>
    </div>
    {!editor ? <div className="min-h-40 p-3 text-sm text-muted-foreground" role="status">Відкриваю редактор…</div> : <EditorContent editor={editor} />}
    {error ? <p role="alert" className="p-3 text-sm text-destructive">{error}</p> : null}
  </div>;
}
