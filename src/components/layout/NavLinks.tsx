/**
 * Fajl: src/components/layout/NavLinks.tsx
 * Svrha: lista linkova glavnog menija za ulogu korisnika; trenutna stranica
 * je istaknuta i označena sa aria-current="page" (za čitače ekrana).
 * Koriste ga: AppShell (bočni meni na računaru) i MobileNav (panel na telefonu).
 * Povezano sa: nav-items.ts (koja uloga vidi koju stavku).
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { getNavItems, isNavItemActive } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/domain";

/**
 * Linkovi menija.
 * Ulaz: uloga korisnika; onNavigate — poziva se posle klika (MobileNav tada zatvara panel).
 */
export function NavLinks({ role, onNavigate }: { role: UserRole; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = getNavItems(role);

  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ key, href, icon: Icon }) => {
        // Aktivna je samo najbliža stavka (/tickets/new ne ističe i /tickets).
        const active = isNavItemActive(href, pathname, items);
        return (
          <li key={key}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t(key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
