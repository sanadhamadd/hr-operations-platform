import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthPage } from "@/components/auth/auth-page";
import styles from "@/components/auth/auth.module.css";
import { loginPath, minimumPasswordLength } from "@/lib/auth/access";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Choose a password" };

const errorMessages: Record<string, string> = {
  short: `Use at least ${minimumPasswordLength} characters.`,
  mismatch: "The passwords do not match.",
  rejected: "That password could not be used. Choose a different one.",
};

export default async function SetPasswordPage({ searchParams }: PageProps<"/auth/set-password">) {
  const viewer = await getViewer();
  if (!viewer) redirect(loginPath);

  const { error } = await searchParams;
  const message = typeof error === "string" ? errorMessages[error] : undefined;

  return (
    <AuthPage title="Choose a password" intro={`Signed in as ${viewer.email}.`}>
      {message ? (
        <p className={styles.error} role="alert">
          {message}
        </p>
      ) : null}

      <form className={styles.form} action="/auth/update-password" method="post">
        <label className={styles.field}>
          New password
          <input
            className={styles.input}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={minimumPasswordLength}
            aria-describedby="password-hint"
            required
          />
          <span className={styles.hint} id="password-hint">
            At least {minimumPasswordLength} characters.
          </span>
        </label>
        <label className={styles.field}>
          Confirm the password
          <input
            className={styles.input}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={minimumPasswordLength}
            required
          />
        </label>
        <button className={styles.button} type="submit">
          Save password
        </button>
      </form>
    </AuthPage>
  );
}
