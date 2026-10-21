/**
 * Fajl: src/components/layout/nav-items.ts
 * Svrha: stavke glavnog menija i koja uloga vidi koju stavku (tabela „Meni po
 * ulozi“ iz docs/06-api-i-stranice.md, sekcija 4).
 * Sakrivanje stavke je samo udobnost; pravu zaštitu rade server (layout.tsx
 * za /admin i /analytics) i API (withApi).
 * Koriste ga: NavLinks (meni na računaru i na telefonu).
 * Korisnik vidi „Moji zahtevi“ i „Novi zahtev“, a tim podrške „Zahtevi“ (ista
 * stranica /tickets, drugačiji naziv). „Obaveštenja“ vide sve uloge (Faza 7).
 */
import {
  Bell,
  ChartColumn,
  FileCode2,
  LayoutDashboard,
  ListTodo,
  SquarePen,
  Tags,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/types/domain";

/** Jedna stavka menija. */
export interface NavItem {
  /** Ključ prevoda u messages/*.json -> nav.<key>. */
  key:
    | "dashboard"
    | "tickets"
    | "myTickets"
    | "newTicket"
    | "notifications"
    | "profile"
    | "analytics"
    | "users"
    | "categories"
    | "apiDocs";
  href: string;
  icon: LucideIcon;
  /** Uloge koje vide stavku. */
  roles: readonly UserRole[];
}

/** Sve stavke, redom kojim se prikazuju. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    key: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["customer", "agent", "admin"],
  },
  { key: "myTickets", href: "/tickets", icon: ListTodo, roles: ["customer"] },
  { key: "newTicket", href: "/tickets/new", icon: SquarePen, roles: ["customer"] },
  { key: "tickets", href: "/tickets", icon: ListTodo, roles: ["agent", "admin"] },
  {
    key: "notifications",
    href: "/notifications",
    icon: Bell,
    roles: ["customer", "agent", "admin"],
  },
  { key: "analytics", href: "/analytics", icon: ChartColumn, roles: ["admin"] },
  { key: "users", href: "/admin/users", icon: Users, roles: ["admin"] },
  { key: "categories", href: "/admin/categories", icon: Tags, roles: ["admin"] },
  { key: "apiDocs", href: "/api-docs", icon: FileCode2, roles: ["admin"] },
  { key: "profile", href: "/profile", icon: UserRound, roles: ["customer", "agent", "admin"] },
];

/**
 * Stavke menija za datu ulogu.
 * Ulaz: uloga prijavljenog korisnika. Vraća: stavke koje ta uloga vidi.
 */
export function getNavItems(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/**
 * Da li putanja pripada stavki (ta stranica ili njena podstranica).
 * Primer: /admin/users pripada i /admin/users/5.
 */
function belongsTo(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Da li je stavka „aktivna“ (korisnik je na toj stranici ili njenoj podstranici).
 * Ulaz: href stavke, trenutna putanja i sve stavke menija koje korisnik vidi.
 * Ako putanji pripada više stavki, aktivna je ona sa najdužom adresom: na
 * /tickets/new je aktivno „Novi zahtev“, a ne i „Moji zahtevi“ (/tickets),
 * dok na /tickets/5 ostaje aktivno „Moji zahtevi“.
 */
export function isNavItemActive(
  href: string,
  pathname: string,
  items: readonly Pick<NavItem, "href">[] = [],
): boolean {
  if (!belongsTo(href, pathname)) return false;
  return !items.some((item) => item.href.length > href.length && belongsTo(item.href, pathname));
}
