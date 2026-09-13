export function safeReturnPath(value: string | null | undefined, fallback = "/meetings") {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;

  try {
    const parsed = new URL(value, "http://local.test");
    if (parsed.origin !== "http://local.test") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}