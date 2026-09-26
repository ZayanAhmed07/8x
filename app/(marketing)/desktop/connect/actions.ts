"use server";
import { getCurrentUser } from "@/lib/auth";
import { createAuthCode, isValidState } from "@/lib/desktop-auth";

export type ApproveResult = { code?: string; error?: string };

export async function approveDesktop(state: string): Promise<ApproveResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session expired. Sign in again." };
  if (!isValidState(state)) return { error: "This link is invalid. Start again from Tally Capture." };
  return { code: await createAuthCode(user.id, state) };
}
