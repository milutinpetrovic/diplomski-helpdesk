/**
 * Fajl: src/lib/openapi/routes/index.ts
 * Svrha: učitava sve fajlove sa Swagger dokumentacijom ruta, da bi se upisali
 * u registar pre pravljenja dokumenta. Kad se doda nova grupa ruta
 * (npr. tickets.ts), dodaje se i ovde.
 * Koristi ga: src/lib/openapi/document.ts.
 */
import "@/lib/openapi/routes/system";
import "@/lib/openapi/routes/auth";
import "@/lib/openapi/routes/profile";
import "@/lib/openapi/routes/tickets";
import "@/lib/openapi/routes/comments";
import "@/lib/openapi/routes/ratings";
import "@/lib/openapi/routes/categories";
import "@/lib/openapi/routes/admin";
