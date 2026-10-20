/**
 * Fajl: src/components/ui/native-select.tsx
 * Svrha: padajuća lista zasnovana na običnom <select> elementu, u izgledu
 * ostalih polja (po uzoru na shadcn/ui „native-select“). Običan <select> radi
 * tastaturom, čitačem ekrana i na telefonu otvara sistemski izbor (NFZ-1, NFZ-4).
 * Koriste ga: forma za novi zahtev, filteri liste, dodela zahteva, profil.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

/** Padajuća lista. Prima sve atribute običnog <select> elementa; opcije su deca. */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
