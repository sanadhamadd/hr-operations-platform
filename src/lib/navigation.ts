export type NavItem = {
  href: string;
  label: string;
};

export type Portal = {
  label: string;
  homeHref: string;
  navigation: readonly NavItem[];
};

export const employeePortal: Portal = {
  label: "Employee portal",
  homeHref: "/chat",
  navigation: [
    { href: "/chat", label: "Chat" },
    { href: "/forms", label: "Forms" },
    { href: "/requests", label: "My Requests" },
  ],
};

export const adminPortal: Portal = {
  label: "HR administration",
  homeHref: "/admin/inbox",
  navigation: [
    { href: "/admin/inbox", label: "HR Inbox" },
    { href: "/admin/people", label: "People" },
    { href: "/admin/questions", label: "Questions" },
    { href: "/admin/analytics", label: "Analytics" },
  ],
};

/** A navigation item is active on its own page and on any page nested beneath it. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
