/**
 * Fajl: src/components/ui/popover.tsx
 * Svrha: mali prozor koji se otvara ispod dugmeta (shadcn/ui komponenta, stil "new-york").
 * Koristi ga: NotificationBell (padajući prozor sa poslednjim obaveštenjima).
 * Zasnovan je na Radix Popover-u, pa sam rešava pristupačnost: otvara se i
 * tastaturom, Escape i klik van prozora ga zatvaraju, a fokus se vraća na dugme.
 */
"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

/** Koren prozora: čuva stanje otvoren/zatvoren. */
function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

/** Dugme koje otvara prozor. */
function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

/**
 * Sadržaj prozora. Iscrtava se u `portal` (na kraju stranice), da ga ne
 * preklope drugi elementi; poravnanje i razmak od dugmeta su podesivi.
 */
function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

/** Element za poravnanje prozora uz neki drugi element (umesto uz dugme). */
function PopoverAnchor(props: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
