/**
 * Fajl: src/app/(app)/layout.tsx
 * Svrha: raspored zaštićenog dela aplikacije (sve stranice posle prijave):
 * proverava da je korisnik prijavljen i da mu je nalog aktivan, pa prikazuje
 * AppShell (zaglavlje i meni po ulozi) oko stranice. Učitava i broj
 * nepročitanih obaveštenja za zvonce u zaglavlju.
 * Folder (app) je „grupa ruta“: ne vidi se u adresi (/dashboard, /profile...).
 * Pristup: customer, agent, admin. Gosta već proxy.ts šalje na /login; ova
 * provera je druga linija odbrane, na serveru (NFZ-2).
 */
import { AppShell } from "@/components/layout/AppShell";
import { requireCurrentUser } from "@/lib/auth/server-session";
import { NotificationService } from "@/services/notifications/notification-service";

/** Raspored sa proverom prijave (serverska komponenta). */
export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  // Korak 1: gost -> /login, deaktiviran nalog -> /login sa porukom.
  const { ctx, profile } = await requireCurrentUser();

  // Korak 2: broj nepročitanih obaveštenja za zvonce (odmah tačan, bez treptanja).
  const unreadCount = await new NotificationService(ctx).countUnread();

  return (
    <AppShell profile={profile} unreadCount={unreadCount}>
      {children}
    </AppShell>
  );
}
