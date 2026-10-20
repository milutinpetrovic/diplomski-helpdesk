/**
 * Fajl: src/lib/validation/admin.ts
 * Svrha: Zod šeme za administraciju naloga. U Fazi 5 samo oblik stavke
 * spiska agenata (GET /api/agents); lista korisnika i izmena uloga dolaze u Fazi 8.
 * Koriste ga: UserAdminService, ruta GET /api/agents i Swagger (routes/admin.ts).
 * Povezano sa: docs/06-api-i-stranice.md (sekcija Administracija).
 */
import { z } from "zod";

import { profileSummarySchema } from "@/lib/validation/common";

/** Agent (ili admin) u spisku za dodelu, sa brojem nerešenih dodeljenih zahteva. */
export const agentSummarySchema = profileSummarySchema
  .extend({
    openAssignedCount: z
      .number()
      .int()
      .meta({ description: "Broj dodeljenih zahteva koji nisu rešeni ni zatvoreni.", example: 3 }),
  })
  .meta({ id: "AgentSummary", description: "Član tima podrške za dodelu zahteva." });

export type AgentSummary = z.infer<typeof agentSummarySchema>;
