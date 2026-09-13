import Image from "next/image";

type BrowserFrameProps = {
  src: string;
  alt: string;
  priority?: boolean;
  compact?: boolean;
};

export function BrowserFrame({ src, alt, priority = false, compact = false }: BrowserFrameProps) {
  return <figure className={`browser-frame ${compact ? "compact" : ""}`}><div className="browser-chrome" aria-hidden="true"><span/><span/><span/></div><Image src={src} alt={alt} width={1400} height={900} priority={priority} sizes={compact ? "(max-width: 860px) 100vw, 33vw" : "(max-width: 860px) 100vw, 48vw"} /></figure>;
}
