/**
 * Fajl: src/components/layout/nav-items.ts
 * Svrha: stavke glavnog menija i koja uloga vidi koju stavku (tabela „Meni po
 * ulozi“ iz docs/06-api-i-stranice.md, sekcija 4).
 * Sakrivanje stavke je samo udobnost; pravu zaštitu rade server (layout.tsx
 * za /admin i /analytics) i API (withApi).
 * Koriste ga: NavLinks (meni na računaru i na telefonu).
 * Stavke „Zahtevi“, „Novi zahtev“ i „Obaveštenja“ dodaju se u fazama 5 i 7.
 */
import {
  ChartColumn,
  FileCode2,
  LayoutDashboard,
  Tags,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/types/domain";

/** Jedna stavka menija. */
export interface NavItem {
  /** Ključ prevoda u messages/*.json -> nav.<key>. */
  key: "dashboard" | "profile" | "analytics" | "users" | "categories" | "apiDocs";
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
 * Da li je stavka „aktivna“ (korisnik je na toj stranici ili njenoj podstranici).
 * Ulaz: href stavke i trenutna putanja. Primer: /admin/users je aktivna i na /admin/users/5.
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
