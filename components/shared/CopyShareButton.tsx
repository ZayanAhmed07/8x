"use client";
import { Copy } from "lucide-react";
import { useState } from "react";
export function CopyShareButton() { const [copied, setCopied] = useState(false); return <button className="button" onClick={async () => { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}><Copy size={16}/>{copied ? "Copied" : "Copy link"}</button>; }
