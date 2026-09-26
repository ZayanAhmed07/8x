// Sample workspace content. `npm run seed` writes it to Postgres; the app never imports this file.
//
// Scripts use a small format so the transcripts stay readable:
//   # Chapter title
//   speaker: what they said ^tag
// Timestamps are derived from word counts at a natural speaking pace.
// Tags anchor commitments, decisions, quotes and clips to the exact line they came from.
import type { ActionItem, Chapter, Highlight, Meeting, MeetingStatus, Moment, Speaker, Summary, SummaryContent, SummaryTemplate, TranscriptSegment } from "../lib/types";

const PEOPLE: Record<string, { name: string; color: string }> = {
  maya: { name: "Maya Chen", color: "#D9572B" },
  jon: { name: "Jon Okafor", color: "#2E7D6B" },
  priya: { name: "Priya Raman", color: "#3B6FB6" },
  leo: { name: "Leo Martins", color: "#A2559C" },
  sam: { name: "Sam Whitaker", color: "#B8871B" },
  iris: { name: "Iris Novak", color: "#5E7F2E" },
  nadia: { name: "Nadia Haddad", color: "#C2466A" },
  owen: { name: "Owen Brooks", color: "#5B6AA8" },
  tess: { name: "Tess Alvarez", color: "#A2559C" },
  dev: { name: "Dev Patel", color: "#B8871B" },
  dana: { name: "Dana Whitfield", color: "#5B6AA8" },
  marco: { name: "Marco Ruiz", color: "#C2466A" },
  alex: { name: "Alex Kim", color: "#2E7D6B" }
};

type Ref = string; // a ^tag in the script
type SeedAction = { tag: Ref; owner: string; text: string; due: string; done?: boolean };
type SeedSection = { title: string; items: (string | [text: string, tag: Ref])[] };
type SeedSummary = { headline: string; sections: SeedSection[] };
type SeedMeeting = {
  id: string;
  title: string;
  date: string;
  /** Only for meetings without a transcript yet; otherwise length comes from the script. */
  minutes?: number;
  status?: MeetingStatus;
  people: string[];
  script?: string;
  summaries?: Partial<Record<SummaryTemplate, SeedSummary>>;
  actions?: SeedAction[];
  clips?: { title: string; from: Ref; to: Ref }[];
};

/** A commitment from one meeting that came up again in a later one. */
export type SeedMention = { actionId: string; meetingId: string; segmentId: string };

const PAUSE_MS = 700;
const MS_PER_WORD = 400; // 150 words a minute

function build(seed: SeedMeeting): { meeting: Meeting; tags: Map<string, TranscriptSegment> } {
  const speakers: Speaker[] = seed.people.map((key) => ({ id: `${seed.id}-${key}`, meetingId: seed.id, name: PEOPLE[key].name, avatarUrl: "", color: PEOPLE[key].color }));
  const lines = (seed.script ?? "").split("\n").map((line) => line.trim()).filter(Boolean);

  const transcript: TranscriptSegment[] = [];
  const chapterStarts: { title: string; startMs: number }[] = [];
  const tags = new Map<string, TranscriptSegment>();
  let clock = 0;
  for (const line of lines) {
    if (line.startsWith("#")) {
      chapterStarts.push({ title: line.replace(/^#\s*/, ""), startMs: clock });
      continue;
    }
    const match = line.match(/^(\w+):\s*(.*?)\s*(?:\^(\w+))?$/);
    if (!match || !PEOPLE[match[1]]) throw new Error(`Bad script line in ${seed.id}: ${line}`);
    const [, key, text, tag] = match;
    const duration = Math.round(text.split(/\s+/).length * MS_PER_WORD);
    const segment: TranscriptSegment = { id: `${seed.id}-seg-${transcript.length + 1}`, meetingId: seed.id, speakerId: `${seed.id}-${key}`, startMs: Math.round(clock), endMs: Math.round(clock + duration), text };
    transcript.push(segment);
    if (tag) tags.set(tag, segment);
    clock += duration + PAUSE_MS;
  }

  const durationMs = transcript.length ? transcript[transcript.length - 1].endMs : (seed.minutes ?? 30) * 60_000;
  const chapters: Chapter[] = chapterStarts.map((chapter, index) => ({ id: `${seed.id}-ch-${index + 1}`, meetingId: seed.id, title: chapter.title, startMs: chapter.startMs, endMs: chapterStarts[index + 1]?.startMs ?? durationMs, order: index + 1 }));
  for (const segment of transcript) segment.chapterId = [...chapters].reverse().find((chapter) => chapter.startMs <= segment.startMs)?.id;

  const at = (tag: Ref) => {
    const segment = tags.get(tag);
    if (!segment) throw new Error(`Unknown tag ^${tag} in ${seed.id}`);
    return segment;
  };
  const moment = (text: string, tag: Ref): Moment => {
    const segment = at(tag);
    return { text, atMs: segment.startMs, speaker: speakers.find((speaker) => speaker.id === segment.speakerId)?.name };
  };
  const summaries: Summary[] = Object.entries(seed.summaries ?? {}).map(([template, summary]) => {
    const content: SummaryContent = {
      headline: summary.headline,
      sections: summary.sections.map((section) => ({ title: section.title, items: section.items.map((item) => (typeof item === "string" ? item : moment(item[0], item[1]))) })),
      bullets: [],
      decisions: [],
      keyQuotes: []
    };
    return { template: template as SummaryTemplate, content };
  });
  const actionItems: ActionItem[] = (seed.actions ?? []).map((action) => ({ id: `${seed.id}-${action.tag}`, meetingId: seed.id, text: action.text, owner: PEOPLE[action.owner].name, dueDate: action.due, completed: Boolean(action.done), status: action.done ? "Done" : "Open", sourceSegmentId: at(action.tag).id }));
  const highlights: Highlight[] = (seed.clips ?? []).map((clip, index) => ({ id: `${seed.id}-clip-${index + 1}`, meetingId: seed.id, startMs: at(clip.from).startMs, endMs: at(clip.to).endMs, title: clip.title, shareToken: `${seed.id}-clip-${index + 1}` }));

  return {
    meeting: { id: seed.id, title: seed.title, date: seed.date, durationSeconds: Math.round(durationMs / 1000), status: seed.status ?? "ready", videoUrl: "", mediaKind: "video", summaryTemplate: "general", shareToken: `${seed.id}-recap`, speakers, chapters, transcript, summaries, actionItems, highlights },
    tags
  };
}

// ---------------------------------------------------------------------------------------------

const pricingSession: SeedMeeting = {
  id: "pricing-session",
  title: "Pricing working session",
  date: "2026-09-15T14:00:00.000Z",
  people: ["maya", "priya", "nadia", "sam"],
  script: `
# Why we're revisiting pricing
maya: Okay, we're recording. Thanks for making time. The goal today is narrow. Decide whether we test usage-based pricing in Q4 or park it until next year. I don't want us redesigning the whole pricing page on this call.
priya: Agreed. Quick context for Nadia, since she missed last week. We keep losing mid-market deals where the buyer has two AP clerks but pushes eight thousand invoices a month through us. Per-seat makes us look cheap, and then procurement asks how we'll handle their volume.
sam: And the small end has the opposite problem. Shops with ten seats and three hundred invoices think we're expensive. Four of them told me this quarter, pretty much in those words, that the seat price is why they walked.
maya: So seats are the wrong axis at both ends. Nadia, you pulled the numbers?
nadia: I did. Short version, seat count barely predicts retention. Invoice volume predicts it really well. Accounts processing more than five hundred invoices a month churn at about a third of the rate of everyone else. ^k1
priya: That's the chart I want on the pricing page, honestly.
maya: Hold that thought. Walk us through the tiers first.
# What the churn data says
nadia: Starter loses four point one percent of accounts a month. Growth is at one point six. Enterprise is basically flat. Almost all of the Starter churn happens in the first ninety days, and those accounts average under two hundred invoices a month. ^k2
sam: That matches what I hear. They sign up, run a month of invoices, look at the bill, and do the math per invoice.
nadia: Right. Their effective cost is about ninety cents an invoice. A Growth account doing two thousand invoices pays closer to eleven cents. ^k3
maya: So our smallest customers pay eight times more per unit of value. No wonder they leave. ^q1
priya: Which is the whole argument for usage. You pay for what flows through the product, and the price grows with the value you get.
sam: My worry is predictability. Finance teams hate a bill they can't forecast. If we go pure usage I'll spend every renewal explaining overages. ^q2
maya: That's fair, and it's the main risk. Nadia, anything else in the data?
nadia: One thing. Eighteen percent of Growth accounts are well over the invoice volume we assumed when we set the tiers. They're getting a great deal and nobody has noticed yet. ^k4
sam: Please don't make that my problem this quarter.
maya: Noted. We won't touch existing accounts without a plan.
# Seats or usage
priya: Here's what I'd propose. Not pure usage. A platform fee per tier, with a generous invoice allowance, and a per-invoice rate above it. Seats become unlimited. That kills the "why am I paying for my clerk" objection completely. ^k5
sam: Unlimited seats is a strong line for sales. I could sell that tomorrow.
nadia: If the Starter allowance sits at around two hundred and fifty invoices, about eighty percent of current Starter accounts would pay less than they do today.
maya: And what happens to revenue?
nadia: Starter revenue drops maybe nine percent in the first quarter. It comes back if churn improves by even one point. I can model that properly, but I need a clean cohort first.
maya: Then that's the bet. We're trading some Starter revenue for retention, and we need to see the retention actually show up.
sam: For predictability, can we cap overages? Say nothing above a hundred and twenty percent of the platform fee without a conversation. ^k6
priya: I like that. It's a promise we can print on the page.
maya: Okay. I'm hearing a direction, not a decision yet. The real decision is whether we test it, and on whom. I'd say new sign-ups only. No migrations. ^d1
priya: Yes. New Starter and Growth sign-ups, and existing customers stay on seats.
maya: Agreed. That's the plan unless the model says something scary. I'll take it to the Q4 planning review.
# Owners
maya: Owners. Nadia, the churn model by tier with the new allowance?
nadia: I'll have churn by plan tier and the revenue model by Friday. ^a1
priya: I'll draft the pricing page copy. Two or three options for how we explain the platform fee and the allowance, with the overage cap in plain language. Say Tuesday next week. ^a2
sam: And I'll get five customer quotes on seat pricing, ideally from people who churned, so we're not guessing at the language. By Friday. ^a3
maya: Great. Thanks everyone.
`,
  summaries: {
    general: {
      headline: "Seats are the wrong pricing axis at both ends. Test a platform fee plus invoice allowance on new sign-ups only.",
      sections: [
        { title: "Decisions", items: [["Test usage-based pricing on new sign-ups only. Existing customers stay on seat pricing.", "d1"]] },
        { title: "Key points", items: [
          ["Invoice volume predicts retention; seat count barely does. Accounts above 500 invoices a month churn at a third of the rate.", "k1"],
          ["Starter churns 4.1% a month vs 1.6% for Growth, mostly in the first 90 days.", "k2"],
          ["Small accounts pay about 90¢ per invoice vs 11¢ for Growth: 8x more per unit of value.", "k3"],
          ["Proposal: platform fee per tier, invoice allowance, per-invoice rate above it, unlimited seats.", "k5"],
          ["Overages capped at 120% of the platform fee to keep bills predictable.", "k6"]
        ] },
        { title: "Quotes", items: [["So our smallest customers pay eight times more per unit of value. No wonder they leave.", "q1"], ["Finance teams hate a bill they can't forecast.", "q2"]] }
      ]
    }
  },
  actions: [
    { tag: "a1", owner: "nadia", text: "Model churn by plan tier and revenue under the new invoice allowance", due: "2026-09-18", done: true },
    { tag: "a2", owner: "priya", text: "Draft pricing page copy options: platform fee, allowance and overage cap", due: "2026-09-22" },
    { tag: "a3", owner: "sam", text: "Collect five customer quotes on seat pricing, ideally from churned accounts", due: "2026-09-18", done: true }
  ],
  clips: [{ title: "Small customers pay 8x more per invoice", from: "k2", to: "q1" }]
};

const acmeDiscovery: SeedMeeting = {
  id: "acme-discovery",
  title: "Acme Logistics · discovery call",
  date: "2026-09-17T16:00:00.000Z",
  people: ["sam", "iris", "dana", "marco"],
  script: `
# Introductions
sam: Dana, Marco, thanks for the time. I've got Iris with me, she runs customer success and would own your rollout if we get there. We're recording so nobody has to take notes. Is that alright?
dana: Totally fine. Marco's on from IT, he'll have the security questions, fair warning.
marco: Just a few. Maybe a lot.
sam: Perfect. Dana, maybe start with how invoices move through Acme today.
# How AP works at Acme today
dana: Sure. We're a freight company, so we get invoices from carriers, fuel suppliers, warehouses, around eight thousand a month across three entities. Most arrive as PDFs in a shared inbox. Two clerks key them into NetSuite by hand. Approvals happen over email. ^p1
iris: When you say approvals over email, is that one approver per invoice or a chain?
dana: Depends on the amount. Under five thousand it's the ops manager. Over that it goes to me, and over fifty thousand to the CFO. And honestly the chain breaks all the time. Someone's on vacation and an invoice sits for two weeks. ^p2
sam: What does that cost you?
dana: Late fees, mainly. We paid about forty thousand dollars in late fees last year. And we miss early-payment discounts from two of our biggest fuel suppliers, which is probably worth more than the late fees. ^p3
iris: That's a very common pattern. Does month-end close suffer too?
dana: Close takes eleven days. My target is five. The clerks spend the first week of every month chasing approvals instead of reconciling. ^p4
# What success looks like
sam: If we fixed the approval chain and got invoices out of the inbox, what would you need to see to call this a success?
dana: Close in six days or less by the end of Q1. And zero late fees on the fuel suppliers. That's the number my CFO will ask about. ^s1
sam: That's a clear target. We can work with that.
dana: The other thing is import. We have eighteen months of history I want in the new system from day one, otherwise the clerks will keep NetSuite open in another tab forever. ^b1
iris: How big is that history?
dana: Maybe a hundred and forty thousand invoices. I can get you a sample file.
iris: Please do. I'll set up a sandbox with your sample data so your clerks can try the approval flow on real invoices, not our demo ones. ^a2
# Security and IT
marco: My turn. Do you support SAML single sign-on? We're on Okta, and anything without SSO won't get past our security review. ^o1
sam: SSO is on our roadmap for this quarter. I'll be honest, it's not generally available today.
marco: Okay. That's a blocker for rollout but maybe not for a pilot. What about SOC 2?
sam: We have a SOC 2 Type Two report, completed in June. I'll send it over under NDA this week. ^a1
marco: Good. And data residency, where is invoice data stored?
iris: US East, on AWS. Encrypted at rest, and we can share the sub-processor list along with the report.
marco: That's fine for us. SSO is really the only hard blocker on my side. ^o2
# Pricing and next steps
dana: Last question from me. How do you price? Our clerks are two people but the volume is big.
sam: Today it's per seat, which would honestly look very cheap for you. We're moving to a model based on invoice volume. I'd rather send you a proposal on eight thousand invoices a month than quote seats and change it later. ^b2
dana: That's refreshing. Send it over.
sam: I'll have a proposal to you by next Wednesday. And we'll get the SOC 2 report to Marco this week. ^a3
dana: And I'll send the invoice volumes by entity, plus the sample file for Iris. ^a4
sam: Perfect. Let's put thirty minutes on the calendar with Marco once the report's in.
marco: Works for me.
`,
  summaries: {
    general: {
      headline: "Acme is a strong enterprise lead: 8,000 invoices a month, $40k a year in late fees, and SSO as the only hard blocker.",
      sections: [
        { title: "Decisions", items: [["Quote Acme on invoice volume, not seats.", "b2"]] },
        { title: "Key points", items: [
          ["About 8,000 invoices a month across three entities; two clerks key PDFs into NetSuite by hand.", "p1"],
          ["Approvals run over email and stall when an approver is away.", "p2"],
          ["$40k in late fees last year, plus missed early-payment discounts.", "p3"],
          ["Wants 18 months of history (~140k invoices) imported before go-live.", "b1"]
        ] },
        { title: "Quotes", items: [["We paid about forty thousand dollars in late fees last year.", "p3"], ["SSO is really the only hard blocker on my side.", "o2"]] }
      ]
    },
    sales: {
      headline: "Qualified: clear pain, a measurable goal and budget. SSO blocks rollout but not a pilot.",
      sections: [
        { title: "Pain", items: [["Manual keying of ~8,000 PDF invoices a month into NetSuite.", "p1"], ["Email approval chains stall for up to two weeks.", "p2"], ["$40k/year in late fees and missed early-payment discounts.", "p3"], ["Month-end close takes 11 days.", "p4"]] },
        { title: "Success criteria", items: [["Close in 6 days or less by end of Q1, zero late fees on fuel suppliers.", "s1"]] },
        { title: "Buying signals", items: [["Wants full history loaded from day one.", "b1"], ["Asked for a volume-based proposal and welcomed it.", "b2"]] },
        { title: "Objections & blockers", items: [["SAML SSO with Okta is required for rollout; not GA today.", "o1"], "Security review needs the SOC 2 Type II report first."] },
        { title: "Next steps", items: ["SOC 2 report to Marco under NDA this week.", "Volume-based proposal by Wednesday.", "Sandbox loaded with Acme's sample data.", "30-minute security review once the report is in."] }
      ]
    }
  },
  actions: [
    { tag: "a1", owner: "sam", text: "Send Acme the SOC 2 Type II report under NDA", due: "2026-09-19" },
    { tag: "a2", owner: "iris", text: "Set up a sandbox loaded with Acme's sample invoices", due: "2026-09-22", done: true },
    { tag: "a3", owner: "sam", text: "Send Acme a volume-based proposal for 8,000 invoices a month", due: "2026-09-23", done: true },
    { tag: "a4", owner: "dana", text: "Share invoice volumes by entity and a sample history file", due: "2026-09-21", done: true }
  ],
  clips: [
    { title: "What late approvals cost Acme", from: "p3", to: "p4" },
    { title: "SSO is the hard blocker", from: "o1", to: "o2" }
  ]
};

const standup: SeedMeeting = {
  id: "platform-standup",
  title: "Platform standup",
  date: "2026-09-22T09:30:00.000Z",
  people: ["jon", "tess", "dev", "leo"],
  script: `
# Yesterday
jon: Morning. Let's keep it quick, I have a hard stop. Dev, you first.
dev: Yesterday I found the CSV import timeout. Anything over five thousand rows hits the thirty second request limit because we validate every row synchronously. I've moved validation into a background job. Should land today, tomorrow at the latest. ^a1
jon: Nice. Does that fix Acme-sized files?
dev: For five to twenty thousand rows, yes. For a hundred and forty thousand we'd need chunked uploads and a proper progress screen. That's not a bug fix anymore, that's a feature. ^r1
jon: Okay, flag that for planning. Tess?
tess: SAML. The login flow works against a mock identity provider. What's left is the admin screen for uploading IdP metadata, and testing against a real Okta tenant. ^n1
# Blockers
tess: Which is my blocker. We still don't have an Okta developer tenant. The request has been sitting with IT for eight days. ^b1
jon: That's on me. I'll escalate it today and get the tenant approved. ^a2
tess: Thanks. Without it I can't promise the date we gave sales.
leo: Related, for the metadata upload screen, do you want me to design the error states? SAML errors are notoriously cryptic.
tess: Yes, please. The raw errors are useless to an admin.
# Today
leo: Today I'm reviewing the approvals empty states. Iris said new accounts land on a blank screen with no hint what to do. I'll have it done tomorrow. ^a3
jon: Good. Tess, realistic date for the metadata upload?
tess: If I get the tenant this week, the twenty-ninth. ^a4
jon: Okay. I'll bring the import versus SSO question to the planning review tomorrow. Thanks all.
`,
  summaries: {
    general: {
      headline: "CSV timeout fixed. SAML is blocked on an Okta test tenant that has waited eight days.",
      sections: [
        { title: "Key points", items: [["Import validation moved to a background job; fixes files up to ~20k rows.", "a1"], ["Acme-sized files (140k rows) need chunked uploads and a progress screen.", "r1"], ["SAML login works against a mock IdP; metadata upload and Okta testing remain.", "n1"]] },
        { title: "Blockers", items: [["Okta developer tenant request stuck with IT for 8 days.", "b1"]] }
      ]
    },
    standup: {
      headline: "One fix landed, one blocker escalated, one planning question queued.",
      sections: [
        { title: "Done", items: [["Dev: import timeout root-caused; validation moved to a background job.", "a1"]] },
        { title: "Next", items: [["Tess: SAML metadata upload screen, target Sep 29.", "a4"], ["Leo: approvals empty states, due tomorrow.", "a3"]] },
        { title: "Blockers", items: [["Tess: no Okta developer tenant. Jon escalating today.", "b1"]] },
        { title: "Risks", items: [["Large imports need a real feature, not a bug fix. Goes to planning.", "r1"]] }
      ]
    }
  },
  actions: [
    { tag: "a1", owner: "dev", text: "Move CSV row validation to a background job to fix the 5k-row timeout", due: "2026-09-24", done: true },
    { tag: "a2", owner: "jon", text: "Get the Okta developer tenant approved for SAML testing", due: "2026-09-23" },
    { tag: "a3", owner: "leo", text: "Fix the approvals empty states for new accounts", due: "2026-09-23", done: true },
    { tag: "a4", owner: "tess", text: "Finish the SAML metadata upload screen", due: "2026-09-29" }
  ]
};

const q4Review: SeedMeeting = {
  id: "q4-planning-review",
  title: "Q4 planning review",
  date: "2026-09-23T15:00:00.000Z",
  people: ["maya", "jon", "priya", "leo", "sam", "iris", "nadia", "owen"],
  script: `
# Agenda
maya: Okay, it's five past, let's start. We're recording, and everyone who couldn't make it will get the recap. Agenda: Q3 launch numbers, the pricing recommendation, the Acme deal and what enterprise is asking us for, and then the hard one, the roadmap trade-off between bulk import and SSO. I want us to leave with decisions and owners, not a list of topics we talked about.
jon: Can we do roadmap before Acme? The Acme conversation is going to turn into the roadmap conversation anyway.
maya: Fair, but I want Sam and Iris to lay out what Acme actually needs first, so we're arguing about facts. Let's keep the order and I'll timebox.
priya: Before we start, is Owen presenting anything?
owen: Not today. I'm mostly here to listen for what's shipping in Q4.
maya: Great. Nadia, the numbers.
# Q3 launch metrics
nadia: Okay, sharing my screen. The headline on Approvals v2. Activation, which we define as a new account approving its first ten invoices inside fourteen days, went from thirty one percent before the launch to thirty eight percent after. That's six weeks of data, around nine hundred new accounts, so I'm fairly confident it's real. ^m0
maya: That's the biggest move we've had on activation all year.
nadia: It is. The mobile approval link is doing most of the work. Forty four percent of approvals now happen from the email link on a phone, and those invoices get approved in a median of three hours instead of two days. ^m0e
jon: Three hours. That's the number I want in the launch post.
nadia: Now the less good part. Time to first invoice didn't move. New accounts still take a median of six days to get their first invoice into the system, and the drop-off is at import. Twenty two percent of accounts that start a CSV import never finish it. ^m1
priya: Do we know why?
nadia: Partly the timeout Dev fixed this week, anything over five thousand rows was failing outright. But even small files fail validation. The most common error is a date format mismatch, and our error message just says row forty seven is invalid.
leo: Which is useless. You don't know what's wrong with row forty seven or how to fix it without opening the file again.
iris: That's half of my onboarding tickets. Literally, I checked. Forty eight percent of tickets from new accounts in September mention import. ^m2
maya: Okay. So activation is up because of approvals, and import is the thing capping us.
nadia: That's how I'd read it. One more number. Net revenue retention for Q3 is a hundred and four percent, down from a hundred and seven. The contraction is almost all Starter accounts reducing seats. ^m3
sam: Which is the pricing problem again.
maya: Right, nice segue. Thanks Nadia, that was clear. Priya, pricing.
# Pricing and packaging
priya: Okay. Recap of where we got to last week with Nadia and Sam. Seat pricing punishes our smallest customers and undercharges our biggest. Small accounts pay about ninety cents per invoice, Growth accounts pay eleven. So the proposal is a platform fee per tier, an invoice allowance, a per-invoice rate above the allowance, and unlimited seats.
jon: Unlimited seats, I like. It also kills a whole category of support tickets about adding users.
priya: Exactly. Nadia's model says eighty percent of current Starter accounts would pay less under the new model, and Starter revenue drops about nine percent in the first quarter. It pays back if Starter churn improves by one point.
maya: And how confident are we that churn improves?
nadia: Moderately. The churned-customer quotes Sam collected were really consistent, four of the five named the seat price directly. But quotes aren't a controlled test.
sam: For the record, one of them said we were priced like a law firm. I think about that a lot. ^q1
priya: So the recommendation is to test it, not roll it out. New sign-ups on Starter and Growth get the new model. Existing customers stay on seats.
iris: How long do existing customers stay on seats? That's the first thing my accounts will ask.
priya: Through Q1 at least, and then we decide based on the test. No forced migration.
iris: I need that in writing, and I need to know what happens to accounts who ask to switch early.
priya: Fair. I'll define the grandfathering rule, including early switches, and share it with you and Sam by next Friday. ^a1
sam: And overages. I asked for a cap last week.
priya: Yes, overages cap at a hundred and twenty percent of the platform fee without a conversation. That goes on the page.
maya: Okay, where's the pricing page copy? I thought we'd have options by now.
priya: That's on me, it slipped. I have two drafts but neither explains the allowance clearly yet. I'll have them to you Monday. ^c1
maya: Okay. Then I'm ready to call it. We run the usage-based test on new Starter and Growth sign-ups, starting October thirteenth. Existing customers stay on seat pricing through Q1, no forced migration. Anyone disagree? ^d1
jon: October thirteenth works for billing if the copy lands Monday. The metering is already there, we just never exposed it.
sam: Agreed.
maya: Good, decided. Nadia, can you own measurement?
nadia: Yes. I'll set up the experiment dashboard. Conversion, average revenue per account, invoices per account, and ninety-day churn once we get there. Ready before launch, so by October second. ^a2
# Acme and enterprise asks
maya: Okay, Acme. Sam.
sam: Acme Logistics. Freight company, eight thousand invoices a month across three entities, two clerks keying into NetSuite. They pay about forty thousand a year in late fees and miss early-payment discounts. Dana, their controller, wants close down from eleven days to six by end of Q1. It's the best-qualified enterprise lead we've had this year.
maya: Deal size?
sam: With volume pricing, roughly ninety thousand a year. I sent them a proposal on Monday and they didn't flinch.
jon: What do they need from us that we don't have?
sam: Three things. SSO with Okta, that's a hard blocker from their IT. Historical import, eighteen months of history, about a hundred and forty thousand invoices, loaded before go-live. And the SOC 2 report for their security review. ^e1
maya: Did the SOC 2 report go out? That was supposed to happen last week.
sam: It didn't, honestly. Legal wanted a new NDA template and it fell between us. I'll send it today. ^c2
maya: Please. That's the cheapest thing on the list and it's blocking their security review.
iris: On import, I have their sample file already, ten thousand rows. I loaded it into a sandbox on Monday. The import got through about sixty percent before it hit validation errors, mostly dates in day-month-year format.
leo: The same date problem.
iris: The same date problem. I'll send the full file to Jon's team today so we can use it for load testing. ^a3
jon: Please do. For a hundred and forty thousand rows we need chunked uploads, a background job with progress, and a way to review errors in bulk. Dev fixed the timeout, but that's not the same as supporting that volume.
maya: How far along is SSO?
jon: Tess has SAML login working against a mock identity provider. The admin screen is half done. We still don't have an Okta test tenant, which is my fault. I said I'd escalate it and it's still sitting with IT. ^c3
maya: Okay. What does Acme do if SSO is November instead of October?
sam: Honestly, I think they'd sign for a pilot without SSO, if import works and they get a written date for SSO. Marco, their IT lead, said as much. SSO blocks rollout, not a pilot.
maya: Then let's give them a written timeline, not a verbal promise. Sam, once we decide the order today, you tell them. ^d2
sam: I'll send Acme the revised timeline by Friday. ^a4
# Roadmap: import or SSO
maya: Okay, the hard one. We have capacity for one of these, properly, in the next six weeks. Jon, lay it out.
jon: Two options. Option one, SSO first. Tess finishes SAML, we test on Okta, ship in about three weeks. Import stays as it is plus Dev's fix. Option two, import first. Chunked uploads, background processing, an error review screen, date format detection. That's about two sprints with Dev and me. SSO continues at half capacity, so it ships mid November instead of mid October. ^r0
priya: What does import first cost us, besides the SSO date?
jon: Possibly Acme, if Sam's wrong about the pilot. And any other enterprise deal that needs SSO this quarter.
sam: I have one other deal that asked about SSO. Smaller, and they're not in a hurry.
maya: And what does SSO first cost us?
nadia: If import stays broken, we keep losing twenty two percent of new accounts at import. At current sign-up rates that's around two hundred accounts a quarter who never get to their first invoice. And the pricing test starts October thirteenth. If new accounts can't import, we won't learn anything from the test, because they'll churn for a different reason. ^r1
iris: Plus half my onboarding tickets.
leo: From the design side, import is also where the product feels least finished. Approvals v2 feels like a real product. Import feels like a form from twenty fifteen. The error review screen is the piece I'd want to get right. Show every error at once, group them by type, and let people fix a whole column instead of one row at a time. ^r2
jon: Grouping by type also makes the date problem trivial. If three thousand rows fail with the same date format, we ask once, is this day-month-year, and fix them all. ^r3
priya: That's a really good interaction. Honestly, that's a feature we could market.
owen: It is. That's a launch.
maya: Okay. I'm hearing import first. Let me check the risk. Sam, you're confident Acme pilots without SSO?
sam: Confident enough, if they have a written date and the import works on their real file. Actually, the import working on their real file is probably the most convincing part of the demo.
maya: Jon, anything that makes you nervous about import first?
jon: Only that SSO at half capacity tends to become SSO at zero capacity. I'd want Tess protected. She stays on SAML, she doesn't get pulled into import.
maya: Agreed, Tess is protected. Decision: bulk import ships first, two sprints. SSO continues at half capacity with Tess, targeting mid November. Nobody pulls Tess into import. ^d3
jon: Good. I'll write the import tech spec. Row limits, chunking, how errors are grouped, and what the review screen needs from the API. By next Wednesday. ^a5
leo: I'll mock the error review screen and bring it to design review by Tuesday, so Jon's spec and my mocks meet in the middle. ^a6
maya: And I need to tell the board SSO moves to November. It was on the Q4 plan I presented. I'll do that by October first. ^a7
# Risks
maya: Okay, risks. Let's go around. What could make this plan fail?
nadia: Measurement. If the pricing test launches with import still broken, I can't separate the effects. Can we ship the date detection piece before October thirteenth, even if the rest of import isn't done? ^k1
jon: Date detection alone, yes. That's small. We can do it first. ^d4
maya: Good, let's do that. Iris?
iris: Existing customers hearing about the new pricing from someone else. If a Growth customer sees unlimited seats on the website before we tell them, I'll have a very bad week. ^k2
priya: That goes into the grandfathering rule. We email existing customers before the page changes.
iris: Then I want to review that email.
priya: Deal.
sam: Mine is Acme's timeline. Their Q1 close target is real. If import slips past early November, they can't hit six days by end of Q1, and then the pilot doesn't matter. ^k3
jon: The two-sprint estimate has some buffer. I'll flag it the day it slips, not the week after.
leo: Mine is scope creep on the review screen. It's tempting to build a spreadsheet editor in the browser. We shouldn't. Group, explain, fix by column. That's it. ^k4
maya: Write that into the spec as a non-goal, please. Jon, and yours is Tess.
jon: And the Okta tenant. Which I'm escalating again today, to the CTO if I have to.
maya: Okay. Owen, anything from marketing?
owen: Just one thing. If import is the launch, I need a date to plan around, even a rough one, and a demo file that isn't fake. I'll draft the launch plan once Jon's spec is out, so by October sixth. ^a8
maya: Good. Iris's Acme file would make a great demo, if Acme is okay with it.
sam: I'll ask them. Anonymized, probably fine.
# Read-back
maya: Okay, let me read it back. Decisions. One, the usage-based pricing test on new Starter and Growth sign-ups from October thirteenth, existing customers on seats through Q1. Two, import ships before SSO, SSO targets mid November with Tess protected. Three, Acme gets a written timeline. Owners are in the recap, and I'll check the open ones at next week's review. ^w1
priya: And the two things that were already late. My pricing copy, and Sam's SOC 2 report.
maya: Right. Priya's copy Monday, Sam's report today. Those were due last week, so I'll look at those first.
sam: Understood.
maya: Thanks everyone. Good meeting.
`,
  summaries: {
    general: {
      headline: "Pricing test starts Oct 13 on new sign-ups. Bulk import ships before SSO, which moves to mid-November.",
      sections: [
        { title: "Decisions", items: [
          ["Run the usage-based pricing test on new Starter and Growth sign-ups from Oct 13. Existing customers stay on seats through Q1.", "d1"],
          ["Bulk import ships first (two sprints). SSO continues at half capacity with Tess, targeting mid-November.", "d3"],
          ["Date-format detection ships before the pricing test, ahead of the rest of import.", "d4"],
          ["Acme gets a written timeline, not a verbal promise.", "d2"]
        ] },
        { title: "Numbers that drove it", items: [
          ["Activation rose from 31% to 38% after Approvals v2.", "m0"],
          ["22% of accounts that start a CSV import never finish it.", "m1"],
          ["48% of September onboarding tickets mention import.", "m2"],
          ["Net revenue retention fell to 104% from 107%, driven by Starter seat contraction.", "m3"]
        ] },
        { title: "Risks raised", items: [
          ["Pricing test results get muddied if import is still broken.", "k1"],
          ["Existing customers learn about new pricing from the website first.", "k2"],
          ["If import slips past early November, Acme misses its Q1 close target.", "k3"],
          ["Scope creep: no spreadsheet editor in the browser. Group, explain, fix by column.", "k4"]
        ] },
        { title: "Quotes", items: [["One of them said we were priced like a law firm.", "q1"], ["Import feels like a form from twenty fifteen.", "r2"]] }
      ]
    }
  },
  actions: [
    { tag: "a1", owner: "priya", text: "Define the grandfathering rule for existing customers, including early switches", due: "2026-10-02" },
    { tag: "a2", owner: "nadia", text: "Set up the pricing experiment dashboard: conversion, ARPA, invoices per account, 90-day churn", due: "2026-10-02" },
    { tag: "a3", owner: "iris", text: "Send Acme's 10k-row sample file to engineering for load testing", due: "2026-09-23", done: true },
    { tag: "a4", owner: "sam", text: "Send Acme a written timeline: import first, SSO mid-November", due: "2026-09-25" },
    { tag: "a5", owner: "jon", text: "Write the bulk import tech spec: row limits, chunking, error grouping, non-goals", due: "2026-09-30" },
    { tag: "a6", owner: "leo", text: "Mock the grouped import error review screen for design review", due: "2026-09-29" },
    { tag: "a7", owner: "maya", text: "Tell the board SSO moves to mid-November", due: "2026-10-01" },
    { tag: "a8", owner: "owen", text: "Draft the bulk import launch plan", due: "2026-10-06" }
  ],
  clips: [
    { title: "Approvals v2 moved activation 31% → 38%", from: "m0", to: "m0e" },
    { title: "Import is what's capping activation", from: "m1", to: "m2" },
    { title: "Fix errors by column, not by row", from: "r2", to: "r3" },
    { title: "Decision: import before SSO", from: "d3", to: "d3" }
  ]
};

const interview: SeedMeeting = {
  id: "pm-interview-alex-kim",
  title: "Senior PM interview · Alex Kim",
  date: "2026-09-25T13:00:00.000Z",
  people: ["maya", "priya", "alex"],
  script: `
# Background
maya: Hi Alex, thanks for coming in. I'm Maya, I lead product here, and this is Priya, who'd be your closest peer. We record interviews so we can focus on the conversation, and so the rest of the panel hears your answers in your words. Is that okay?
alex: Of course. Nice to meet you both.
maya: Let's start with the last product you owned end to end. What was it, and what changed because of you?
alex: For the last three years I've been at a payroll company, owning contractor payments. When I joined, payouts took five business days and about eight percent failed on the first attempt, usually bad bank details. I rebuilt onboarding to verify bank accounts up front, and we moved to same-day payouts for verified accounts. Failures went under one percent, and contractor payments became our fastest growing line. ^s1
priya: What was the hardest trade-off in that?
alex: Verification added a step to onboarding, and sales hated it because it slowed down the demo. We lost some conversion at the top of the funnel. I had to show that the accounts we lost were mostly the ones that would have failed payouts anyway. That took a month of data and a lot of patience. ^s2
maya: How did you convince sales in the end?
alex: Honestly, the data didn't convince them. I sat in on support calls with them for a week. Once they heard a contractor upset because rent was late, the extra step stopped being controversial.
# Case: the import funnel
priya: Okay, let's do a case. You're the PM for our import feature. Twenty two percent of new accounts start a CSV import and never finish it. What do you do in your first two weeks?
alex: First question is whether they fail or give up. Those are different problems. I'd want the funnel inside the import: upload, mapping, validation, confirmation. And I'd want to read maybe fifty failed files myself, not just the error logs. ^s3
priya: Say most of them fail at validation.
alex: Then I'd group the errors by type. My guess, from payroll, is that a handful of error types cause most failures. Dates, currencies, duplicate IDs. If one type is half of it, fix that type really well before building anything general. ^s4
maya: That's pretty much what we concluded internally this week.
alex: Then I'd look at what the user sees. If the error message is "row forty seven is invalid", that's a design problem more than an engineering one.
priya: What would you not do?
alex: I wouldn't build a spreadsheet editor in the browser. It's tempting, it's months of work, and people already have Excel. ^s5
# Working style
maya: Tell me about a time you disagreed with your engineering lead and you were wrong.
alex: We had a launch where I pushed to ship a reconciliation report a week early for a big customer. My tech lead wanted another week of testing. I pushed, we shipped, and the report double counted reversed payments for two days. The customer caught it before we did. ^c1
priya: What did you change after that?
alex: I stopped negotiating dates with customers on my own. Now the tech lead and I agree on what done means before anyone talks to the customer. And I give customers the date we both believe, not the one I hope for. ^c2
maya: How do you run a meeting with eight people and three opinions?
alex: I write down the decision I think we're heading toward at the start, and ask people to attack it. It's much faster than collecting opinions. And I read back owners at the end, out loud. If nobody owns it, it didn't happen. ^s6
priya: That's exactly the problem our product is trying to solve, for what it's worth.
alex: I noticed. It's part of why I applied.
# Questions and close
alex: Can I ask you both something? What would make this hire a failure in six months?
maya: Good question. If import still loses a fifth of new accounts in March, that's a failure, regardless of how good the roadmap docs are. ^x1
priya: For me, if I'm still the only person talking to enterprise customers about the roadmap.
alex: That's helpful. Very concrete.
maya: Next step is a take-home. Priya will send you a short brief, an import problem with real anonymized data. We'd like it back within a week.
priya: I'll send it tomorrow morning. ^a1
alex: Great, looking forward to it. Thank you both.
maya: Thanks Alex. Priya, scorecards to me by Monday so we can decide next week. ^a2
`,
  summaries: {
    general: {
      headline: "Strong candidate. Alex's case answer independently matched the team's import plan. Take-home next.",
      sections: [
        { title: "Key points", items: [
          ["Owned contractor payments: payout failures from 8% to under 1%, fastest-growing line.", "s1"],
          ["Approached the import case by separating 'fail' from 'give up' and reading failed files directly.", "s3"],
          ["Would fix the dominant error type first; explicitly ruled out a browser spreadsheet editor.", "s5"]
        ] },
        { title: "Decisions", items: [["Move Alex to the take-home stage.", "a1"]] },
        { title: "Quotes", items: [["If nobody owns it, it didn't happen.", "s6"]] }
      ]
    },
    interview: {
      headline: "Recommend advancing. Clear ownership, sharp product instincts, one past miss on dates handled maturely.",
      sections: [
        { title: "Strengths", items: [["Measurable outcomes and owns the trade-offs behind them.", "s2"], ["Structured, data-first approach to an unfamiliar funnel.", "s3"], ["Runs decisions, not discussions: proposes a decision and reads back owners.", "s6"]] },
        { title: "Concerns", items: [["Once pushed a launch date over engineering's objection; caused a customer-facing bug.", "c1"], "No direct accounts-payable domain experience."] },
        { title: "How they'd handle our problems", items: [["Group import errors by type and fix the dominant one first.", "s4"], ["Ruled out a browser spreadsheet editor as scope creep.", "s5"]] },
        { title: "Recommendation", items: [["Advance to take-home. Success bar set in the interview: import loses under a fifth of new accounts by March.", "x1"]] }
      ]
    }
  },
  actions: [
    { tag: "a1", owner: "priya", text: "Send Alex Kim the take-home brief with anonymized import data", due: "2026-09-26" },
    { tag: "a2", owner: "maya", text: "Collect interviewer scorecards for Alex Kim", due: "2026-09-28" }
  ],
  clips: [{ title: "How Alex would attack the import funnel", from: "s3", to: "s4" }]
};

const acmePilot: SeedMeeting = {
  id: "acme-pilot-scoping",
  title: "Acme Logistics · pilot scoping",
  date: "2026-09-25T17:30:00.000Z",
  minutes: 41,
  status: "processing",
  people: ["sam", "iris", "dana"]
};

const built = [pricingSession, acmeDiscovery, standup, q4Review, interview, acmePilot].map((seed) => ({ seed, ...build(seed) }));

export const seedMeetings: Meeting[] = built.map((item) => item.meeting);

// Late commitments that were raised again in the Q4 review.
const q4Tags = built.find((item) => item.seed.id === q4Review.id)!.tags;
export const seedMentions: SeedMention[] = [
  { actionId: "pricing-session-a2", tag: "c1" },
  { actionId: "acme-discovery-a1", tag: "c2" },
  { actionId: "platform-standup-a2", tag: "c3" }
].map(({ actionId, tag }) => ({ actionId, meetingId: q4Review.id, segmentId: q4Tags.get(tag)!.id }));
