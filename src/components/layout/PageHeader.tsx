/**
 * Fajl: src/components/layout/PageHeader.tsx
 * Svrha: naslov (h1) i kratak opis na vrhu svake stranice u zaštićenom delu.
 * Koriste ga: stranice u src/app/(app)/.
 */
import type * as React from "react";

/** Naslov stranice. Ulaz: već prevedeni naslov i opcioni opis. */
export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="text-muted-foreground">{description}</p> : null}
    </div>
  );
}
