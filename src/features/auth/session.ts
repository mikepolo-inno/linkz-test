import { auth, currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/db";

type AppSession = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
  };
};

export async function getSession(): Promise<AppSession | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const existingUser = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, email: true, name: true },
  });
  if (existingUser) {
    return { user: existingUser };
  }

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
  const name = clerkUser?.fullName ?? clerkUser?.username ?? null;

  const user = await prisma.user.create({
    data: { clerkUserId, email, name },
    select: { id: true, email: true, name: true },
  });

  return { user };
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
