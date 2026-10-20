/**
 * Fajl: src/components/ui/sonner.tsx
 * Svrha: mesto na ekranu gde se prikazuju kratke poruke (toast), npr. „Profil je sačuvan“
 * (shadcn/ui omotač oko biblioteke sonner).
 * Koristi ga: root layout (src/app/layout.tsx) — postavlja se jednom za celu aplikaciju;
 * poruke se zatim prikazuju pozivom toast.success("...") iz bilo koje klijentske komponente.
 */
"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Kontejner za toast poruke, u bojama teme aplikacije. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
