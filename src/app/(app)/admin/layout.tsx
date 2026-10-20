/**
 * Fajl: src/app/(app)/admin/layout.tsx
 * Svrha: provera uloge za SVE stranice pod /admin (korisnici, kategorije):
 * samo administrator; korisnik i agent vide poruku „Nemate pristup“.
 * Ovo je RBAC na serveru; API rute /api/admin/* imaju svoju proveru u withApi.
 */
import { Forbidden } from "@/components/layout/Forbidden";
import { requirePageRole } from "@/lib/auth/server-session";

/** Raspored sa proverom uloge admin. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requirePageRole(["admin"]);
  return user ? children : <Forbidden />;
}
