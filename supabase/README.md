# supabase — baza podataka

Supabase CLI konfiguracija (`config.toml`), SQL migracije (`migrations/`) i početni podaci (`seed.sql`).
Šema, RLS matrica i tok statusa: `docs/02-baza-podataka.md`.

| Migracija                        | Sadržaj                                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `..._enums.sql`                  | šema `private`, enum tipovi                                                                                                       |
| `..._profiles.sql`               | `profiles`, trigeri `handle_new_user`, `sync_profile_email`, `set_updated_at`, `prevent_role_self_change`                         |
| `..._helpers.sql`                | `current_user_role()`, `is_staff()`, `is_admin()`, RLS za `profiles`, pogled `profile_summaries`                                  |
| `..._categories.sql`             | `categories` + RLS                                                                                                                |
| `..._tickets.sql`                | `tickets`, indeksi, pretraga teksta, RLS, `can_view_ticket()`                                                                     |
| `..._comments_history.sql`       | `ticket_comments`, `ticket_history` + RLS                                                                                         |
| `..._ratings_notifications.sql`  | `ticket_ratings`, `notifications` + RLS, real-time publikacija                                                                    |
| `..._rpc_tickets.sql`            | RPC: `create_ticket`, `update_ticket`, `add_comment`, `assign_ticket`, `change_ticket_status`, `rate_ticket`, `admin_update_user` |
| `..._realtime_authorization.sql` | dozvole za privatne kanale `ticket:<id>`, `staff`, `user:<id>`                                                                    |

Nova migracija: `pnpm exec supabase migration new <naziv>`, pa `pnpm db:reset` i `pnpm db:types`.
Testovi baze su u `tests/integration/` (`pnpm test:db`).
