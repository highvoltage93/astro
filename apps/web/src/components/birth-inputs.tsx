"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { displayBirthDate, displayBirthTime, parseBirthDateText, parseBirthTimeText } from "@/lib/birth-input";

type BirthInputProps = { value: string; onValueChange: (value: string) => void; disabled?: boolean; required?: boolean };

function BirthTextInput({ kind, value, onValueChange, disabled = false, required = true }: BirthInputProps & { kind: "date" | "time" }) {
  const parse = kind === "date" ? parseBirthDateText : parseBirthTimeText;
  const display = kind === "date" ? displayBirthDate : displayBirthTime;
  const [text, setText] = useState(() => display(value));
  const [touched, setTouched] = useState(false);
  const published = useRef(value);
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const message = kind === "date" ? "Вкажіть дійсну дату: ДД.ММ.РРРР." : "Вкажіть час від 00:00:00 до 23:59:59.";
  const invalid = !disabled && (text.trim() ? !parse(text) : required);

  useEffect(() => {
    if (value === published.current) return;
    published.current = value;
    setText(display(value)); setTouched(false);
  }, [value, display]);
  useEffect(() => { input.current?.setCustomValidity(invalid ? message : ""); }, [invalid, message]);

  return <div className="min-w-0 space-y-1">
    <Input ref={input} type="text" inputMode="numeric" autoComplete="off" spellCheck={false}
      aria-label={kind === "date" ? "Дата народження, ДД.ММ.РРРР" : "Час народження, години:хвилини:секунди"}
      aria-invalid={touched && invalid || undefined} aria-describedby={touched && invalid ? errorId : undefined}
      placeholder={kind === "date" ? "ДД.ММ.РРРР" : "ГГ:ХХ:СС"} maxLength={kind === "date" ? 10 : 8}
      required={required} disabled={disabled} value={text}
      onInvalid={() => setTouched(true)}
      onChange={(event) => {
        const next = event.target.value;
        const parsed = parse(next);
        setText(next);
        event.target.setCustomValidity(!disabled && (next.trim() ? !parsed : required) ? message : "");
        // Publish empty on partial input so a button outside a form cannot reuse an old date/time.
        published.current = parsed ?? "";
        onValueChange(published.current);
      }}
      onBlur={() => {
        setTouched(true);
        const parsed = parse(text);
        if (parsed) {
          setText(display(parsed));
          if (parsed !== published.current) { published.current = parsed; onValueChange(parsed); }
        }
      }} />
    {touched && invalid ? <p id={errorId} className="text-xs text-destructive">{message}</p> : null}
  </div>;
}

export function BirthDateInput(props: BirthInputProps) { return <BirthTextInput {...props} kind="date" />; }
export function BirthTimeInput(props: BirthInputProps) { return <BirthTextInput {...props} kind="time" />; }
