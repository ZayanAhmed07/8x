import Link from "next/link";
import { listActionBoardItems } from "@/lib/db/queries";
import { requireUser } from "@/lib/auth";
import { AskPanel } from "@/components/meeting/AskPanel";
const columns = [
  ["Open", "open"],
  ["In progress", "progress"],
  ["Done", "done"]
] as const;

export default async function ActionsPage() {
  const user = await requireUser();
  const items = await listActionBoardItems(user.id);
  return <><div className="page-head"><div><p className="eyebrow">Execution</p><h1>Action Board</h1><p className="muted">Tasks do not disappear inside individual meeting notes.</p></div></div><AskPanel /><div className="board" style={{marginTop:18}}>{columns.map(([column, tone]) => <section className="column" key={column}><h2 className="column-heading"><span className={`column-dot ${tone}`} />{column}</h2><div className="grid">{items.filter((item) => item.status === column).map((item) => <Link className="card" key={item.id} href={`/meetings/${item.meetingId}?action=${item.id}`}><strong>{item.text}</strong><p className="muted">{item.meeting}</p><span className="badge">{item.owner} - {item.dueDate}</span></Link>)}</div></section>)}</div></>;
}
