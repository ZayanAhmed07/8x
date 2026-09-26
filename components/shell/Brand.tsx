import Link from "next/link";

export function Brand({ href = "/meetings" }: { href?: string }) {
  return <Link href={href} className="brand" aria-label="Tally home"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/></span>Tally</Link>;
}
