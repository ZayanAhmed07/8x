import type { CSSProperties } from "react";
import { initials } from "@/lib/format";

export function Avatar({ name, color, large = false }: { name: string; color?: string; large?: boolean }) {
  return <span className={`avatar${large ? " large" : ""}`} style={{ "--c": color } as CSSProperties} title={name} aria-hidden="true">{initials(name)}</span>;
}

export function AvatarStack({ people, max = 5 }: { people: { name: string; color?: string }[]; max?: number }) {
  const shown = people.slice(0, max);
  return <span className="avatar-stack" aria-label={people.map((person) => person.name).join(", ")}>
    {shown.map((person) => <Avatar key={person.name} {...person}/>)}
    {people.length > max && <span className="avatar more">+{people.length - max}</span>}
  </span>;
}
