import Link from "next/link";

import { adminPortal, employeePortal } from "@/lib/navigation";
import { site } from "@/lib/site";

import styles from "./page.module.css";

const portals = [
  {
    portal: employeePortal,
    summary: "For employees: HR questions, forms and request tracking.",
  },
  {
    portal: adminPortal,
    summary: "For the HR team: review queues, people management and analytics.",
  },
];

export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{site.productName}</h1>
      <p className={styles.intro}>
        This is an early application foundation. Employee and HR administrator features are not
        available yet.
      </p>
      <p className={styles.notice}>
        Sign-in is not enabled in this preview, so both portals are open for demonstration. All
        content refers to {site.organizationName}, a fictional organization.
      </p>

      <h2 className={styles.sectionTitle}>Choose a portal</h2>
      <ul className={styles.portalList}>
        {portals.map(({ portal, summary }) => (
          <li key={portal.homeHref} className={styles.portalCard}>
            <Link className={styles.portalLink} href={portal.homeHref}>
              {portal.label}
            </Link>
            <p className={styles.portalSummary}>{summary}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
