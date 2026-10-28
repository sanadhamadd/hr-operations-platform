import Link from "next/link";
import type { ReactNode } from "react";

import { site } from "@/lib/site";
import type { Portal } from "@/lib/navigation";

import { PortalNav } from "./portal-nav";
import styles from "./portal-shell.module.css";

type PortalShellProps = {
  portal: Portal;
  children: ReactNode;
};

export function PortalShell({ portal, children }: PortalShellProps) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>

      <header className={styles.header}>
        <div className={styles.brand}>
          <Link className={styles.productName} href={portal.homeHref}>
            {site.productName}
          </Link>
          <span className={styles.portalLabel}>{portal.label}</span>
        </div>
        <Link className={styles.switchLink} href="/">
          Switch portal
        </Link>
      </header>

      <p className={styles.previewBanner}>
        Preview build: sign-in is not enabled yet and pages describe planned features only.
      </p>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <PortalNav label={portal.label} items={portal.navigation} />
        </aside>
        <main className={styles.main} id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      <footer className={styles.footer}>
        Demonstration data for {site.organizationName}, a fictional organization.
      </footer>
    </div>
  );
}
