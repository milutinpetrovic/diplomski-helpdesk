/**
 * Fajl: src/app/(app)/analytics/layout.tsx
 * Svrha: provera uloge za /analytics (RBAC na serveru): stranica je samo za
 * administratora; korisnik i agent vide poruku „Nemate pristup“.
 * Sakriven link u meniju nije dovoljan (docs/06, sekcija 4) — zato provera ovde.
 */
import { Forbidden } from "@/components/layout/Forbidden";
import { requirePageRole } from "@/lib/auth/server-session";

/** Raspored sa proverom uloge admin. */
export default async function AnalyticsLayout({ children }: LayoutProps<"/analytics">) {
  const user = await requirePageRole(["admin"]);
  return user ? children : <Forbidden />;
}
