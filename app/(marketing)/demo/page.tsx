import { redirect } from "next/navigation";

// Signed-out visitors land in the seeded sample workspace, which is read from the database.
export default function DemoPage() {
  redirect("/meetings");
}
