"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActivePath, type NavItem } from "@/lib/navigation";

import styles from "./portal-nav.module.css";

type PortalNavProps = {
  label: string;
  items: readonly NavItem[];
};

export function PortalNav({ label, items }: PortalNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label={label}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              className={styles.link}
              href={item.href}
              aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
