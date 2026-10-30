import Link from "next/link";
import type { ReactNode } from "react";

import { site } from "@/lib/site";

import styles from "./auth.module.css";

type AuthPageProps = {
  title: string;
  intro: string;
  children: ReactNode;
};

/** Layout for the sign-in and account pages that sit outside the portals. */
export function AuthPage({ title, intro, children }: AuthPageProps) {
  return (
    <main className={styles.main}>
      <Link className={styles.productName} href="/">
        {site.productName}
      </Link>
      <div className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.intro}>{intro}</p>
        {children}
      </div>
    </main>
  );
}
