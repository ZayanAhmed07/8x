import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, AudioLines, CornerDownRight, Download, Link2, Lock, MessageSquareQuote, Play, Rows3, Sparkles } from "lucide-react";
import { RevealOnScroll, Spotlight } from "@/components/landing/Effects";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { Splash } from "@/components/landing/Splash";
import { Brand } from "@/components/shell/Brand";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Tally: meeting notes that show their work",
  description: "Tally records your calls without a bot and turns them into who owes what, each promise linked to the second it was said."
};

const DOWNLOAD_URL = process.env.NEXT_PUBLIC_CAPTURE_DOWNLOAD_URL ?? "https://github.com/ZayanAhmed07/8x/releases/latest";

// Real commitments from the sample workspace, for the receipts strip.
const RECEIPTS = [
  { who: "Priya", text: "Draft pricing page copy", note: "3 days late", at: "4:40", color: "#3B6FB6" },
  { who: "Jon", text: "Write the import tech spec", note: "Due Wed", at: "11:58", color: "#2E7D6B" },
  { who: "Sam", text: "Send Acme the SOC 2 report", note: "Came up again", at: "3:04", color: "#B8871B" },
  { who: "Nadia", text: "Set up the pricing dashboard", note: "Due 2 Oct", at: "6:11", color: "#C2466A" },
  { who: "Leo", text: "Mock the error review screen", note: "Due Tue", at: "12:06", color: "#A2559C" },
  { who: "Maya", text: "Tell the board SSO moves", note: "Due 1 Oct", at: "12:14", color: "#D9572B" },
  { who: "Iris", text: "Send Acme's sample file", note: "Done", at: "8:21", color: "#5E7F2E" }
];

const LANES = [["Maya", "#D9572B", "24%"], ["Jon", "#2E7D6B", "17%"], ["Nadia", "#C2466A", "17%"], ["Sam", "#B8871B", "14%"], ["Owen", "#5B6AA8", "3%"]] as const;

export default async function LandingPage() {
  const user = await getCurrentUser().catch(() => null);
  const primary = user ? { href: "/meetings", label: "Open your workspace" } : { href: "/meetings", label: "Explore a live workspace" };

  return <div className="landing">
    <Splash/>
    <RevealOnScroll/>

    <header className="l-nav">
      <Brand href="/"/>
      <nav aria-label="Sections">
        <a href="#how">How it works</a>
        <a href="#features">Features</a>
        <a href="#capture">Desktop app</a>
      </nav>
      <div className="l-nav-cta">
        {!user && <Link href="/sign-in" className="l-link">Sign in</Link>}
        <Link href={primary.href} className="l-btn l-btn-light">{user ? "Open workspace" : "Try it live"}<ArrowRight size={15}/></Link>
      </div>
    </header>

    <Spotlight className="l-hero">
      <div className="l-hero-grid" aria-hidden="true"/>
      <div className="l-hero-copy">
        <p className="l-pill"><span className="l-dot"/>No bot in your calls · Tally Capture for Windows</p>
        <h1>Meetings end.<br/><em>Commitments</em> shouldn&apos;t.</h1>
        <p className="l-sub">Tally records your calls without a bot, then turns them into <strong>who owes what</strong>: every promise linked to the second it was said, and raised again the next time that person is in the room.</p>
        <div className="l-ctas">
          <Link href={primary.href} className="l-btn l-btn-accent">{primary.label}<ArrowRight size={16}/></Link>
          <a href={DOWNLOAD_URL} className="l-btn l-btn-ghost"><Download size={16}/>Download for Windows</a>
        </div>
        <p className="l-fine">The live workspace needs no sign-up. It&apos;s real data you can search, clip and share.</p>
      </div>
      <div className="l-hero-demo"><HeroDemo/></div>
    </Spotlight>

    <section className="l-receipts" aria-label="Commitments from the sample workspace">
      <div className="l-marquee">
        {[...RECEIPTS, ...RECEIPTS].map((item, index) => <span className="l-receipt" key={index} aria-hidden={index >= RECEIPTS.length}>
          <i style={{ background: item.color }}/><b>{item.who}</b>{item.text}<em className={item.note.includes("late") || item.note.includes("again") ? "hot" : ""}>{item.note}</em><span className="l-stamp">▶ {item.at}</span>
        </span>)}
      </div>
    </section>

    <section className="l-problem" data-reveal>
      <p className="l-eyebrow">The problem</p>
      <h2>Notes tell you what was said.<br/><span>Nobody checks what got done.</span></h2>
      <div className="l-problem-grid">
        <div><strong>Action items die in the recap.</strong><p>Every tool writes a lovely summary. Two days later nobody opens it, and “I&apos;ll send it Monday” quietly becomes “did that go out?”</p></div>
        <div><strong>Late work surfaces a week too late.</strong><p>You find out a promise slipped when a customer asks. By then it&apos;s been late for six days.</p></div>
        <div><strong>Nobody watches the recording.</strong><p>An hour-long video isn&apos;t a handoff. People who weren&apos;t there need the decisions and the owners, not the replay.</p></div>
      </div>
    </section>

    <section className="l-section" id="features">
      <div className="l-head" data-reveal>
        <p className="l-eyebrow">What Tally does</p>
        <h2>A meeting becomes a ledger,<br/>not a transcript.</h2>
      </div>
      <div className="l-bento">
        <article className="l-card l-card-wide" data-reveal>
          <div className="l-card-copy"><span className="l-icon"><Sparkles size={17}/></span><h3>Commitments with receipts</h3><p>Every “I&apos;ll do it” becomes a commitment with an owner and a due date, and a receipt: one click plays the exact moment it was agreed.</p></div>
          <div className="l-mock l-mock-commit">
            <div className="l-mock-row"><span className="l-check"/><div><strong>Write the bulk import tech spec</strong><span><i style={{ background: "#2E7D6B" }}/>Jon Okafor · Due Wed 30 Sep</span></div><span className="l-stamp">▶ 11:58</span></div>
            <div className="l-mock-row"><span className="l-check on">✓</span><div><strong className="done">Send Acme&apos;s sample file to engineering</strong><span><i style={{ background: "#5E7F2E" }}/>Iris Novak · Done</span></div><span className="l-stamp">▶ 8:21</span></div>
            <div className="l-mock-row"><span className="l-check"/><div><strong>Tell the board SSO moves to November</strong><span><i style={{ background: "#D9572B" }}/>Maya Chen · Due 1 Oct</span></div><span className="l-stamp">▶ 12:14</span></div>
          </div>
        </article>

        <article className="l-card" data-reveal>
          <span className="l-icon"><CornerDownRight size={17}/></span><h3>It follows people into the next meeting</h3><p>Open commitments show up whenever their owner is in the room again, with the moment they came up.</p>
          <div className="l-mock l-mock-carry"><span className="late">6 days late</span><strong>Send Acme the SOC 2 report</strong><q>“It didn&apos;t, honestly. Legal wanted a new NDA template.”</q><span className="l-mini">Came up again · Q4 planning review · 7:13</span></div>
        </article>

        <article className="l-card" data-reveal>
          <span className="l-icon"><Rows3 size={17}/></span><h3>See an hour at a glance</h3><p>Speaker lanes show who drove the call, and who never got a word in.</p>
          <div className="l-mock l-mock-lanes">{LANES.map(([who, color, share], index) => <div key={who}><span>{who}</span><div className="l-lane" style={{ "--c": color, "--d": `${index * 0.3}s` } as CSSProperties}><i/><i/><i/></div><em className={share === "3%" ? "quiet" : ""}>{share}</em></div>)}</div>
        </article>

        <article className="l-card" data-reveal>
          <span className="l-icon"><MessageSquareQuote size={17}/></span><h3>Ask, and get the receipt</h3><p>Ask across every meeting in plain words. Answers cite the lines they came from.</p>
          <div className="l-mock l-mock-ask"><p className="q">Why does import come before SSO?</p><p className="a">If import stays broken, 22% of new accounts never reach their first invoice, and the pricing test can&apos;t be read.</p><span className="l-stamp">▶ Nadia · 12:31</span></div>
        </article>

        <article className="l-card" data-reveal>
          <span className="l-icon"><Link2 size={17}/></span><h3>Catch-up links for people who weren&apos;t there</h3><p>Share a recap that reads in a minute: decisions, owners, and clips as text.</p>
          <div className="l-mock l-mock-share"><span className="l-mini">tally / share / q4-planning-review</span><strong>A 1-minute read instead of a 60-minute recording.</strong></div>
        </article>

        <article className="l-card l-card-dark" data-reveal id="capture">
          <div className="l-card-copy"><span className="l-icon"><AudioLines size={17}/></span><h3>No bot. Nothing joins your call.</h3><p>Tally Capture records your mic and your computer&apos;s audio as separate tracks, so the transcript knows which lines are yours. It spots your Meet, Zoom or Teams call and offers to record. Nothing starts until you say so.</p></div>
          <div className="l-mock l-mock-meters"><div><span>You</span><div className="l-meter"><i/></div></div><div><span>Others on the call</span><div className="l-meter alt"><i/></div></div></div>
        </article>
      </div>
    </section>

    <section className="l-section l-how" id="how">
      <div className="l-head" data-reveal><p className="l-eyebrow">How it works</p><h2>Three steps. The last one is the point.</h2></div>
      <ol className="l-steps">
        <li data-reveal><span className="l-num">01</span><h3>Record</h3><p>Press Record in Tally Capture, or let it spot your Meet, Zoom or Teams call and offer. Nothing records until you say so.</p></li>
        <li data-reveal><span className="l-num">02</span><h3>Tally</h3><p>Minutes after you stop, you get a transcript by speaker, chapters, decisions, and who owes what, each linked to its moment.</p></li>
        <li data-reveal><span className="l-num">03</span><h3>Follow through</h3><p>Late commitments surface in the next meeting with the right people, and on one board for the whole team.</p></li>
      </ol>
    </section>

    <section className="l-section l-where" data-reveal>
      <p className="l-eyebrow">Works where you meet</p>
      <h2>If your computer can hear it, Tally can tally it.</h2>
      <div className="l-chips">{["Google Meet in the browser", "Zoom", "Microsoft Teams", "Slack huddles", "Webex", "Phone calls on speaker"].map((name) => <span key={name}>{name}</span>)}</div>
      <p className="l-fine dark"><Lock size={13}/> Recordings are stored privately and played through links that expire. Sign any device out from Settings.</p>
    </section>

    <section className="l-final" data-reveal>
      <h2>Every meeting,<br/><em>tallied.</em></h2>
      <div className="l-ctas center">
        <Link href={primary.href} className="l-btn l-btn-accent">{primary.label}<ArrowRight size={16}/></Link>
        <a href={DOWNLOAD_URL} className="l-btn l-btn-ghost"><Download size={16}/>Download for Windows</a>
      </div>
      <p className="l-fine"><Play size={12}/> The live workspace is a real product team&apos;s two weeks: planning, a customer call, a standup and an interview.</p>
    </section>

    <footer className="l-footer">
      <Brand href="/"/>
      <span>Built by Zayan Ahmed for 8x, starting from Fathom.</span>
      <nav><Link href="/meetings">Live workspace</Link><Link href="/sign-in">Sign in</Link><a href={DOWNLOAD_URL}>Download</a></nav>
    </footer>
  </div>;
}
