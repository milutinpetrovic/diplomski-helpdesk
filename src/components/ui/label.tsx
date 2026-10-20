/**
 * Fajl: src/components/ui/label.tsx
 * Svrha: natpis (labela) uz polje forme (shadcn/ui komponenta, stil "new-york").
 * Klik na labelu stavlja fokus na polje, a čitač ekrana čita labelu uz polje (pristupačnost, NFZ-4).
 * Koristi ga: FormField (src/components/forms/FormField.tsx) i sve forme.
 */
"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

/** Labela; povezuje se sa poljem preko atributa htmlFor = id polja. */
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
