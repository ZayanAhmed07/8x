import { Inbox } from "lucide-react";
export function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) { return <div className="card" style={{textAlign:"center", padding:"36px"}}><Inbox style={{margin:"0 auto 10px"}}/><h3>{title}</h3>{action}</div>; }
