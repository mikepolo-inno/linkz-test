"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

type AuthButtonProps = {
  email?: string | null;
};

export function AuthButton({ email }: AuthButtonProps) {
  const router = useRouter();

  if (!email) {
    return <a className="button secondary" href="/login">Login</a>;
  }

  async function handleLogout() {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="auth-inline">
      <span>{email}</span>
      <button
        className="button secondary"
        onClick={handleLogout}
        type="button"
      >
        Logout
      </button>
    </div>
  );
}
