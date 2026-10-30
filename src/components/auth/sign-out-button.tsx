import styles from "./auth.module.css";

export function SignOutButton() {
  return (
    <form action="/auth/logout" method="post">
      <button className={styles.secondaryButton} type="submit">
        Sign out
      </button>
    </form>
  );
}
