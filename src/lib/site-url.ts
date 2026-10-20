/**
 * Fajl: src/lib/site-url.ts
 * Svrha: adresa aplikacije (npr. https://helpdesk.vercel.app) za linkove koje
 * šalje Supabase: potvrda emaila, reset lozinke i povratak sa Google prijave.
 * Koriste ga: API rute za prijavu (src/app/api/auth/**).
 * Povezano sa: NEXT_PUBLIC_SITE_URL u .env.example; ista adresa mora biti
 * upisana u Supabase (Site URL i Redirect URLs), inače Supabase odbija preusmerenje.
 */

/**
 * Vraća osnovnu adresu aplikacije bez "/" na kraju.
 * Redosled: NEXT_PUBLIC_SITE_URL (ako je podešen), inače adresa sa koje je
 * stigao zahtev (radi i na Vercel-u i na Netlify-ju bez dodatnog podešavanja).
 */
export function getSiteUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const base = configured || new URL(request.url).origin;
  return base.replace(/\/+$/, "");
}
