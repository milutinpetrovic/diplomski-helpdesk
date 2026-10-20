/**
 * Fajl: src/components/ui/textarea.tsx
 * Svrha: polje za unos dužeg teksta (shadcn/ui komponenta, prepisana ručno u
 * istom obliku kao button i card, vidi CLAUDE.md, sekcija 10).
 * Koriste ga: forma za novi zahtev (opis), komentari i ocena (komentar uz ocenu).
 */
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Višeredno polje. Prima sve atribute običnog <textarea> elementa.
 * Kad je aria-invalid="true" (greška u formi), okvir postaje crven.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
