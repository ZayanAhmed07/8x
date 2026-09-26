"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** A warm glow that follows the pointer across the hero. */
export function Spotlight({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  return <section ref={ref} className={className} onPointerMove={(event) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    ref.current!.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    ref.current!.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }}>{children}</section>;
}

/** Fades in every [data-reveal] element as it scrolls into view. */
export function RevealOnScroll() {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("in"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add("in"); observer.unobserve(entry.target); }
    }, { rootMargin: "0px 0px -10% 0px" });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  return null;
}
