"use client";
import { useEffect, useState } from "react";

const KEY = "tally:splash-seen";
const DURATION_MS = 2300;

/**
 * The first-visit intro: the bar mark rises like an audio meter, the wordmark writes itself,
 * then the page is revealed. Once per session, skippable, and off for reduced motion.
 */
export function Splash() {
  const [phase, setPhase] = useState<"hidden" | "playing" | "leaving">("hidden");

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === "1"; } catch { /* storage blocked: just play it */ }
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPhase("playing");
    document.documentElement.classList.add("splash-lock");
    const leave = window.setTimeout(() => setPhase("leaving"), DURATION_MS);
    return () => window.clearTimeout(leave);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const skip = () => setPhase("leaving");
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    // Marked seen only once it has played, so a double-run effect can't skip it half-way.
    try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    const id = window.setTimeout(() => { setPhase("hidden"); document.documentElement.classList.remove("splash-lock"); }, 700);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === "hidden") return null;
  return <div className={`splash${phase === "leaving" ? " leaving" : ""}`} onClick={() => setPhase("leaving")} role="presentation">
    <div className="splash-stage">
      <div className="splash-bars" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map((index) => <i key={index} style={{ animationDelay: `${index * 70}ms` }}/>)}</div>
      <div className="splash-word" aria-label="Tally">{"Tally".split("").map((letter, index) => <span key={index} style={{ animationDelay: `${700 + index * 90}ms` }}>{letter}</span>)}</div>
      <p className="splash-line">Every meeting, tallied.</p>
    </div>
    <span className="splash-skip">Click or press any key to skip</span>
  </div>;
}
