import Link from "next/link";
import { X } from "lucide-react";
import { CommitmentItem } from "@/components/commitments/CommitmentItem";
import { Avatar } from "@/components/shell/Avatar";
import { listCommitments, type Commitment } from "@/lib/db/commitments";
import { listMeetings } from "@/lib/db/queries";
import { isLate } from "@/lib/format";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Commitments" };

const VIEWS = [
  { key: "open", label: "Open", test: (item: Commitment) => !item.completed },
  { key: "late", label: "Late", test: (item: Commitment) => isLate(item.dueDate, item.completed) },
  { key: "done", label: "Done", test: (item: Commitment) => item.completed },
  { key: "all", label: "All", test: () => true }
] as const;

export default async function CommitmentsPage({ searchParams }: { searchParams: Promise<{ view?: string; owner?: string }> }) {
  const [viewer, query] = await Promise.all([getViewer(), searchParams]);
  const [commitments, meetings] = await Promise.all([listCommitments(viewer.workspaceUserId), listMeetings(viewer.workspaceUserId)]);
  const colors = Object.fromEntries(meetings.flatMap((meeting) => meeting.speakers.map((speaker) => [speaker.name, speaker.color])));
  const view = VIEWS.find((item) => item.key === query.view) ?? VIEWS[0];
  const owner = query.owner && commitments.some((item) => item.owner === query.owner) ? query.owner : undefined;
  const scoped = owner ? commitments.filter((item) => item.owner === owner) : commitments;
  const shown = scoped.filter(view.test);

  const groups = new Map<string, Commitment[]>();
  for (const item of shown) groups.set(item.owner, [...(groups.get(item.owner) ?? []), item]);
  const ordered = [...groups.entries()].sort((a, b) => b[1].filter((item) => isLate(item.dueDate, item.completed)).length - a[1].filter((item) => isLate(item.dueDate, item.completed)).length || b[1].length - a[1].length);
  const href = (next: { view?: string; owner?: string | null }) => {
    const params = new URLSearchParams();
    const nextView = next.view ?? view.key;
    const nextOwner = next.owner === null ? undefined : next.owner ?? owner;
    if (nextView !== "open") params.set("view", nextView);
    if (nextOwner) params.set("owner", nextOwner);
    const search = params.toString();
    return search ? `/actions?${search}` : "/actions";
  };

  return <div className="page narrow">
    <div className="page-head">
      <div>
        <h1>Commitments</h1>
        <p>Everything anyone agreed to do, from every meeting. Each one links to the moment it was said, and shows when it came up again.</p>
      </div>
    </div>

    <div className="board-filters">
      <nav className="segmented" aria-label="Filter commitments">
        {VIEWS.map((item) => <Link key={item.key} href={href({ view: item.key })} aria-current={item.key === view.key ? "true" : undefined}>{item.label} <span className="n">{scoped.filter(item.test).length}</span></Link>)}
      </nav>
      {owner && <Link className="badge outline" href={href({ owner: null })} style={{ height: 30, padding: "0 10px" }}><Avatar name={owner} color={colors[owner]}/>{owner}<X size={13}/></Link>}
    </div>

    {ordered.length === 0 && <div className="empty"><h3>{view.key === "late" ? "Nothing is late" : "Nothing here"}</h3><p>{view.key === "late" ? "Everyone is on track." : "Commitments show up here as meetings are recorded."}</p></div>}
    {ordered.map(([name, items]) => {
      const late = items.filter((item) => isLate(item.dueDate, item.completed)).length;
      return <section className="owner-group" key={name} aria-label={name}>
        <header>
          <Avatar name={name} color={colors[name]} large/>
          <h2><Link href={href({ owner: name })}>{name}</Link></h2>
          {late > 0 && <span className="badge late">{late} late</span>}
          <span className="badge">{items.length} {view.key === "done" ? "done" : view.key === "all" ? "total" : "open"}</span>
        </header>
        <ul className="commitments">{items.map((item) => <CommitmentItem key={item.id} item={item} color={colors[item.owner]} showOwner={false} showSource/>)}</ul>
      </section>;
    })}
  </div>;
}
