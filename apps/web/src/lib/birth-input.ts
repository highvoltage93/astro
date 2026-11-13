export function parseBirthDateText(input: string): string | null {
  const text = input.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const local = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(text);
  const [year, month, day] = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    : local ? [Number(local[3]), Number(local[2]), Number(local[1])] : [0, 0, 0];
  if (!year || year < 1 || year > 9999 || !month || month < 1 || month > 12 || !day) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > days[month - 1]!) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseBirthTimeText(input: string): string | null {
  const text = input.trim();
  const parts = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text) ?? /^(\d{2})(\d{2})(\d{2})?$/.exec(text);
  if (!parts) return null;
  const hour = Number(parts[1]); const minute = Number(parts[2]); const second = Number(parts[3] ?? "00");
  if (hour > 23 || minute > 59 || second > 59) return null;
  return `${parts[1]}:${parts[2]}:${parts[3] ?? "00"}`;
}

export function displayBirthDate(value: string): string {
  const iso = parseBirthDateText(value);
  return iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : value;
}

export function displayBirthTime(value: string): string {
  return parseBirthTimeText(value) ?? value;
}
