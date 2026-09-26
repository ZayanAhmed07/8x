"use client";
import { Check, Link2 } from "lucide-react";
import { useState } from "react";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  return <button className="button small" type="button" onClick={copy}>{copied ? <Check size={14}/> : <Link2 size={14}/>}{copied ? "Copied" : "Copy link"}</button>;
}
