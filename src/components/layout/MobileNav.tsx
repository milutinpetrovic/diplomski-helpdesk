/**
 * Fajl: src/components/layout/MobileNav.tsx
 * Svrha: meni na telefonu (NFZ-1 responzivnost): dugme sa tri crte otvara
 * bočni panel sa istim linkovima kao bočni meni na računaru. Na širem ekranu
 * (od 768 px) dugme se ne prikazuje.
 * Koristi ga: AppShell (zaglavlje).
 */
"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";

import { NavLinks } from "@/components/layout/NavLinks";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { UserRole } from "@/types/domain";

/**
 * Dugme i panel menija za telefon.
 * Ulaz: uloga (za stavke menija) i ime korisnika (na telefonu se ne vidi u zaglavlju, pa je u panelu).
 */
export function MobileNav({ role, fullName }: { role: UserRole; fullName: string }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tRoles = useTranslations("roles");
  // Panel se zatvara posle klika na link.
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("openMenu")}>
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" closeLabel={t("closeMenu")}>
        <SheetHeader>
          <SheetTitle>{tCommon("appName")}</SheetTitle>
          <SheetDescription>
            {fullName} · {tRoles(role)}
          </SheetDescription>
        </SheetHeader>
        <nav aria-label={t("label")} className="px-2">
          <NavLinks role={role} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
