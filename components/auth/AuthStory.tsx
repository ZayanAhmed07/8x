import { Check, CornerDownRight, Play } from "lucide-react";

/** The pitch, shown as the product rather than described. */
export function AuthStory() {
  return <aside className="auth-story">
    <h2>Every meeting ends with <em>who owes what</em>, and the moment they said it.</h2>
    <p>Tally turns calls into commitments with receipts. When something slips, you see it the next time that person is in the room.</p>
    <div className="auth-proof" aria-hidden="true">
      <ul className="commitments"><li>
        <span className="check"><Check size={13} strokeWidth={3}/></span>
        <div>
          <div className="commitment-text">Send Acme the SOC 2 Type II report under NDA</div>
          <div className="commitment-meta"><span className="owner"><span className="avatar" style={{ background: "#B8871B" }}>SW</span>Sam Whitaker</span><span className="due late">Late</span><span className="stamp"><Play size={11}/>Acme discovery · 17 Sep · 3:02</span></div>
          <div className="mention"><CornerDownRight size={13} style={{ marginTop: 3 }}/><span><strong>Came up again in Q4 planning review</strong><br/><q>It didn&apos;t, honestly. Legal wanted a new NDA template and it fell between us.</q></span></div>
        </div>
      </li></ul>
    </div>
  </aside>;
}
