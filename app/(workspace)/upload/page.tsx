import { UploadMeetingForm } from "@/components/meeting/UploadMeetingForm";
import { requireUser } from "@/lib/auth";

export default async function UploadPage() {
  await requireUser();
  return <div className="page narrow"><div className="page-head"><div><h1>Upload a recording</h1><p>We transcribe it, split it by speaker, and pull out decisions and who owes what.</p></div></div><UploadMeetingForm /></div>;
}