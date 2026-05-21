import { getServerSession } from "next-auth";

import { authOptions } from "@/features/auth/options";

export function getSession() {
  return getServerSession(authOptions);
}

/**
 * Returns the authenticated user id or null. Server-side helpers that need to
 * differentiate between "logged out" (401) and "not allowed" (403) should call
 * this directly rather than throwing.
 */
export async function getUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}
