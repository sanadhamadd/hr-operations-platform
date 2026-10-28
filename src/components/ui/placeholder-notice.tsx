import { useId } from "react";

import styles from "./placeholder-notice.module.css";

type PlaceholderNoticeProps = {
  plannedCapabilities: readonly string[];
};

/** Marks a page whose features are planned but not yet implemented. */
export function PlaceholderNotice({ plannedCapabilities }: PlaceholderNoticeProps) {
  const headingId = useId();

  return (
    <section className={styles.notice} aria-labelledby={headingId}>
      <p className={styles.status}>Not available yet</p>
      <h2 className={styles.heading} id={headingId}>
        Planned for this page
      </h2>
      <ul className={styles.list}>
        {plannedCapabilities.map((capability) => (
          <li key={capability}>{capability}</li>
        ))}
      </ul>
    </section>
  );
}
