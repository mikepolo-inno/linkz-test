import { redirect } from "next/navigation";

import { LoginForm } from "@/components/LoginForm";
import { getSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getSession();

  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="page narrow">
      <a className="back-link" href="/">Back to seats</a>
      <h1>Login</h1>
      <p className="muted">
        Sign in to select a seat and proceed to the mock payment flow.
      </p>
      <LoginForm />
    </main>
  );
}
