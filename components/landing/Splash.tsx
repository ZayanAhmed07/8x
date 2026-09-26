"use client";
import { useEffect, useState } from "react";

const KEY = "tally:splash-seen";
const DURATION_MS = 2300;

// Runs before the splash is parsed, so returning visitors never see it and new visitors
// never see the page flash first. It only reads sessionStorage and sets classes on <html>.
const DECIDE = `try{var d=document.documentElement;if(sessionStorage.getItem("${KEY}")==="1"||matchMedia("(prefers-reduced-motion: reduce)").matches){d.classList.add("splash-seen")}else{d.classList.add("splash-lock")}}catch(e){document.documentElement.classList.add("splash-seen")}`;

/**
 * The first-visit intro: the bar mark rises like an audio meter, the wordmark writes itself,
 * then the page is revealed. Once per session, skippable, and off for reduced motion.
 */
export function Splash() {
  const [phase, setPhase] = useState<"playing" | "leaving" | "hidden">("playing");

  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains("splash-seen")) { setPhase("hidden"); return; }
    const leave = window.setTimeout(() => setPhase("leaving"), DURATION_MS);
    const skip = () => setPhase("leaving");
    window.addEventListener("keydown", skip, { once: true });
    return () => { window.clearTimeout(leave); window.removeEventListener("keydown", skip); };
  }, []);

  useEffect(() => {
    if (phase !== "leaving") return;
    try { sessionStorage.setItem(KEY, "1"); } catch { /* storage blocked */ }
    const id = window.setTimeout(() => {
      setPhase("hidden");
      document.documentElement.classList.remove("splash-lock");
      document.documentElement.classList.add("splash-seen");
    }, 700);
    return () => window.clearTimeout(id);
  }, [phase]);

  return <>
    <script dangerouslySetInnerHTML={{ __html: DECIDE }}/>
    {phase !== "hidden" && <div className={`splash${phase === "leaving" ? " leaving" : ""}`} onClick={() => setPhase("leaving")} role="presentation">
      <div className="splash-stage">
        <div className="splash-bars" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map((index) => <i key={index} style={{ animationDelay: `${index * 70}ms` }}/>)}</div>
        <div className="splash-word" aria-label="Tally">{"Tally".split("").map((letter, index) => <span key={index} style={{ animationDelay: `${700 + index * 90}ms` }}>{letter}</span>)}</div>
        <p className="splash-line">Every meeting, tallied.</p>
      </div>
      <span className="splash-skip">Click or press any key to skip</span>
    </div>}
  </>;
}
