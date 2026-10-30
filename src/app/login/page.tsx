import type { Metadata } from "next";

import { AuthPage } from "@/components/auth/auth-page";
import styles from "@/components/auth/auth.module.css";
import { safeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Sign in" };

const errorMessages: Record<string, string> = {
  missing: "Enter your email address and password.",
  invalid: "The email address or password is incorrect.",
  disabled: "This account has been disabled. Contact the HR team if you need access.",
  "no-membership":
    "This account has not been given access to the platform. Contact the HR team if you need access.",
  link: "This invitation link is invalid or has expired. Ask the HR team for a new invitation.",
  unavailable: "Sign-in is temporarily unavailable. Try again shortly.",
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(firstValue(params.next), null);
  const error = errorMessages[firstValue(params.error) ?? ""];
  const signedOut = firstValue(params.signed_out) === "1";

  return (
    <AuthPage title="Sign in" intro="Use the account your HR team created for you.">
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {signedOut && !error ? (
        <p className={styles.status} role="status">
          You have signed out.
        </p>
      ) : null}

      <form className={styles.form} action="/auth/login" method="post">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label className={styles.field}>
          Email address
          <input
            className={styles.input}
            name="email"
            type="email"
            autoComplete="username"
            required
          />
        </label>
        <label className={styles.field}>
          Password
          <input
            className={styles.input}
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button className={styles.button} type="submit">
          Sign in
        </button>
      </form>
    </AuthPage>
  );
}
