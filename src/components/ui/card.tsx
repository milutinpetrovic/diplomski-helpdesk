/**
 * Fajl: src/components/ui/card.tsx
 * Svrha: kartica, okvir za grupisanje sadržaja (shadcn/ui komponenta, stil "new-york").
 * Koriste ga: početna stranica, kasnije dashboard, detalji zahteva, analitika.
 * Delovi: Card (okvir), CardHeader (zaglavlje), CardTitle (naslov), CardDescription (podnaslov),
 * CardAction (akcija u zaglavlju), CardContent (sadržaj), CardFooter (podnožje).
 */
import * as React from "react";

import { cn } from "@/lib/utils";

/** Spoljni okvir kartice. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

/** Zaglavlje kartice (naslov, opis i opciona akcija desno). */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

/** Naslov kartice. */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  );
}

/** Kratak opis ispod naslova. */
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/** Mesto za dugme ili meni u gornjem desnom uglu kartice. */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

/** Glavni sadržaj kartice. */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6", className)} {...props} />;
}

/** Podnožje kartice (najčešće dugmad). */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
