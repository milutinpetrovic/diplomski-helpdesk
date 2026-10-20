# src/lib/auth — autentifikacija i provera uloga

- `auth-guard.ts`, `auth-context.ts` — ko je prijavljen i koja mu je uloga (API rute, kroz `withApi`). Faza 3.
- `server-session.ts` — isto za serverske stranice: `requireCurrentUser()`, `requirePageRole(roles)`. Faza 4.
- `route-access.ts` — pravila preusmerenja koja koristi `src/proxy.ts` (gost -> `/login`, prijavljen -> `/dashboard`). Faza 4.
