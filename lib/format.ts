import type { Moment, SummaryContent, SummarySection } from "@/lib/types";

export function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

export function duration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const shortFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "Wed 23 Sep" */
export const day = (iso: string) => dayFormat.format(new Date(iso));
/** "15:00" */
export const time = (iso: string) => timeFormat.format(new Date(iso));
/** "23 Sep" */
export const shortDate = (iso: string) => shortFormat.format(new Date(iso));

export function isLate(dueDate: string, completed: boolean, now = new Date()) {
  return !completed && dueDate < now.toISOString().slice(0, 10);
}

/** "Due 30 Sep", "Due today", "3 days late" */
export function dueLabel(dueDate: string, completed: boolean, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  if (dueDate === today) return completed ? "Was due today" : "Due today";
  if (!completed && dueDate < today) {
    const days = Math.round((Date.parse(today) - Date.parse(dueDate)) / 86_400_000);
    return `${days} ${days === 1 ? "day" : "days"} late`;
  }
  return `Due ${shortDate(`${dueDate}T00:00:00Z`)}`;
}

export function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function asMoment(item: string | Moment): Moment {
  return typeof item === "string" ? { text: item } : item;
}

/** Summaries from the AI pipeline use flat fields; hand-built and templated ones use sections. */
export function summarySections(content: SummaryContent): SummarySection[] {
  if (content.sections?.length) return content.sections;
  return [
    { title: "Decisions", items: content.decisions ?? [] },
    { title: "Key points", items: content.bullets ?? [] },
    { title: "Quotes", items: content.keyQuotes ?? [] }
  ].filter((section) => section.items.length > 0);
}
