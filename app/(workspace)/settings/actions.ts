"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { revokeDevice } from "@/lib/desktop-auth";

export async function revokeDeviceAction(formData: FormData) {
  const user = await getCurrentUser();
  const id = formData.get("id");
  if (!user || typeof id !== "string") return;
  await revokeDevice(user.id, id);
  revalidatePath("/settings");
}
