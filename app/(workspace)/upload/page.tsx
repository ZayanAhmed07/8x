import { UploadMeetingForm } from "@/components/meeting/UploadMeetingForm";
import { requireUser } from "@/lib/auth";

export default async function UploadPage() {
  await requireUser();
  return <><div className="page-head"><div><p className="eyebrow">Meeting upload</p><h1>Upload</h1><p className="muted">Create a searchable meeting workspace from a recording.</p></div></div><UploadMeetingForm /></>;
}