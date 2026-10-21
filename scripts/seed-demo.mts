/**
 * Fajl: scripts/seed-demo.mts
 * Svrha: realni demo podaci za odbranu i snimke ekrana (Faza 8, docs/02 sekcija 9):
 *   - nalozi: uz 5 naloga iz supabase/seed.sql još 2 agenta i 18 korisnika
 *     (ukupno 1 admin, 4 agenta, 20 korisnika), lozinka Lozinka123!
 *   - oko 150 zahteva kroz poslednjih 6 meseci (radnim danima više), sa
 *     realnim odnosom statusa (većina rešena ili zatvorena, deo otvoren),
 *     prioritetima, kategorijama i agentima koji rade različitom brzinom
 *   - uz svaki zahtev 1–8 komentara (deo internih beleški), istorija promena
 *     i vremena koja imaju smisla (prvi odgovor posle kreiranja, rešenje posle toga)
 *   - CSAT ocene za oko 60% rešenih zahteva (pretežno 4 i 5)
 *
 * Skripta je DETERMINISTIČKA: generator slučajnih brojeva ima fiksan početni
 * broj, pa su podaci (raspored i odnosi) isti pri svakom pokretanju. Vremena su
 * relativna u odnosu na trenutak pokretanja, pa grafikoni uvek pokazuju
 * „poslednjih 6 meseci“.
 * Može da se pokrene više puta: prvo briše zahteve koje je sama napravila
 * (zahteve demo korisnika; komentari, istorija i ocene se brišu kaskadno),
 * pa ih pravi ponovo. Podaci iz seed.sql (#1001–#1012) se ne diraju.
 *
 * Pokretanje: `pnpm seed:demo` (čita .env.local). Potrebne promenljive:
 *   NEXT_PUBLIC_SUPABASE_URL (ili SUPABASE_URL) i SUPABASE_SERVICE_ROLE_KEY.
 * service_role ključ zaobilazi RLS, zato se koristi SAMO ovde, nikad u src/.
 * Radi u Node-u (22.18+) bez dodatnih paketa: Node sam uklanja TypeScript tipove.
 *
 * Povezano sa: supabase/seed.sql (kategorije i osnovni nalozi),
 * tests/unit/seed-demo.test.ts (provera generatora), README (Demo podaci).
 */
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

import type { Database, Json } from "../src/types/database";

// =============================================================================
// 1. Osnovni podaci: nalozi, kategorije, agenti
// =============================================================================

/** Lozinka svih demo naloga (ista kao u seed.sql). */
export const DEMO_PASSWORD = "Lozinka123!";

/** Početni broj generatora: isti broj = isti podaci. */
export const DEMO_RANDOM_SEED = 20261021;

/** Koliko dana unazad se prave zahtevi (~6 meseci). */
export const DEMO_DAYS = 182;

/** Kategorije iz seed.sql (fiksni ID-jevi). */
const CATEGORY = {
  technical: "10000000-0000-4000-8000-000000000001",
  account: "10000000-0000-4000-8000-000000000002",
  billing: "10000000-0000-4000-8000-000000000003",
  featureRequest: "10000000-0000-4000-8000-000000000004",
  other: "10000000-0000-4000-8000-000000000005",
} as const;
type CategoryKey = keyof typeof CATEGORY;

type TicketPriority = Database["public"]["Enums"]["ticket_priority"];
type HistoryAction = Database["public"]["Enums"]["history_action"];

/** Demo nalog koji skripta pravi (ID-jevi u opsegu ...-8001-..., da se ne mešaju sa seed.sql). */
export interface DemoUser {
  id: string;
  email: string;
  fullName: string;
  role: "customer" | "agent";
}

/** Pravi ID demo naloga: 00000000-0000-4000-8001-0000000000NN. */
function demoUserId(index: number): string {
  return `00000000-0000-4000-8001-${index.toString().padStart(12, "0")}`;
}

/** Email bez dijakritika: „Anđela Tomić“ -> andjela.tomic@demo.helpdesk.test. */
function demoEmail(fullName: string): string {
  const ascii = fullName.toLowerCase().replaceAll("đ", "dj").normalize("NFD").replace(/[̀-ͯ]/g, "");
  return `${ascii.replace(" ", ".")}@demo.helpdesk.test`;
}

/** Imena novih agenata i korisnika. */
const NEW_AGENT_NAMES = ["Marija Petković", "Bojan Ristić"];
const NEW_CUSTOMER_NAMES = [
  "Ivana Jovanović",
  "Stefan Nikolić",
  "Milica Marković",
  "Luka Đorđević",
  "Jovana Stojanović",
  "Nemanja Ilić",
  "Teodora Pavlović",
  "Filip Milošević",
  "Sara Popović",
  "Aleksa Kostić",
  "Katarina Lazić",
  "Vuk Simić",
  "Anđela Tomić",
  "Petar Živković",
  "Nina Radovanović",
  "Uroš Stanković",
  "Tamara Obradović",
  "Dušan Vasić",
];

/** Svi nalozi koje skripta pravi (prvo agenti, pa korisnici). */
export const DEMO_USERS: DemoUser[] = [
  ...NEW_AGENT_NAMES.map((fullName, index) => ({
    id: demoUserId(index + 1),
    email: demoEmail(fullName),
    fullName,
    role: "agent" as const,
  })),
  ...NEW_CUSTOMER_NAMES.map((fullName, index) => ({
    id: demoUserId(index + 101),
    email: demoEmail(fullName),
    fullName,
    role: "customer" as const,
  })),
];

/** Admin iz seed.sql (povremeno sam preuzme zahtev). */
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Tim podrške: svaki agent ima svoju brzinu (množilac vremena; manje = brže),
 * sklonost oceni (pozitivno = bolje ocene) i udeo u preuzetim zahtevima.
 * Zato se agenti u tabeli učinka realno razlikuju.
 */
const TEAM = [
  { id: "00000000-0000-4000-8000-000000000002", speed: 1.0, ratingBias: 0.1, share: 0.3 },
  { id: "00000000-0000-4000-8000-000000000003", speed: 0.75, ratingBias: 0.35, share: 0.28 },
  { id: demoUserId(1), speed: 1.35, ratingBias: -0.35, share: 0.2 },
  { id: demoUserId(2), speed: 0.9, ratingBias: 0.0, share: 0.18 },
  { id: ADMIN_ID, speed: 0.8, ratingBias: 0.2, share: 0.04 },
];

// =============================================================================
// 2. Tekstovi zahteva i komentara (po kategoriji)
// =============================================================================

/** Naslov i opis zahteva. */
interface TicketText {
  title: string;
  description: string;
}

/** Primeri zahteva po kategoriji (korisnički tekst je na srpskom). */
const TICKET_TEXTS: Record<CategoryKey, TicketText[]> = {
  technical: [
    {
      title: "Aplikacija se zatvara pri otvaranju izveštaja",
      description:
        "Kad otvorim mesečni izveštaj, aplikacija se posle par sekundi sama zatvori. Dešava se od jučerašnjeg ažuriranja.",
    },
    {
      title: "Stranica se sporo učitava",
      description:
        "Kontrolna tabla se učitava i po 30 sekundi, a ranije je bilo odmah. Probao sam i drugi pregledač, isto je.",
    },
    {
      title: "Greška 500 pri čuvanju podešavanja",
      description:
        "Kad promenim podešavanja obaveštenja i kliknem Sačuvaj, dobijem poruku o grešci 500 i ništa se ne sačuva.",
    },
    {
      title: "Izvoz u PDF ne radi",
      description:
        "Dugme za izvoz u PDF ne radi ništa. Nema poruke o grešci, samo se ništa ne desi.",
    },
    {
      title: "Ne prikazuju se slike u porukama",
      description:
        "Slike koje kolege pošalju u porukama se ne prikazuju, vidi se samo prazan okvir.",
    },
    {
      title: "Mobilna aplikacija ne šalje obaveštenja",
      description:
        "Na telefonu ne dobijam obaveštenja iako su uključena u podešavanjima telefona i aplikacije.",
    },
    {
      title: "Pogrešno vreme na zakazanim sastancima",
      description: "Sastanci koje zakažem prikazuju se sat vremena ranije nego što sam ih uneo.",
    },
  ],
  account: [
    {
      title: "Ne mogu da se prijavim na nalog",
      description:
        "Unosim tačnu lozinku, ali dobijam poruku da su podaci pogrešni. Lozinku nisam menjao.",
    },
    {
      title: "Nije stigao email za reset lozinke",
      description:
        "Zatražio sam promenu lozinke tri puta, ali email nije stigao. Proverio sam i neželjenu poštu.",
    },
    {
      title: "Promena email adrese na nalogu",
      description: "Promenio sam posao i treba mi nova email adresa na nalogu. Kako to da uradim?",
    },
    {
      title: "Nalog je zaključan posle više pokušaja",
      description:
        "Pogrešio sam lozinku nekoliko puta i sada piše da je nalog zaključan. Kada mogu ponovo da pokušam?",
    },
    {
      title: "Prijava preko Google naloga ne radi",
      description:
        "Kad kliknem Nastavi sa Google nalogom, vrati me na početnu stranicu bez prijave.",
    },
    {
      title: "Brisanje starog naloga",
      description:
        "Imam dva naloga sa različitim adresama. Želim da obrišem stari i zadržim samo novi.",
    },
  ],
  billing: [
    {
      title: "Dva puta naplaćena pretplata",
      description:
        "Na izvodu vidim da mi je pretplata za ovaj mesec naplaćena dva puta. Molim povraćaj jedne uplate.",
    },
    {
      title: "Ne mogu da preuzmem račun",
      description:
        "Treba mi račun za prošli mesec za knjigovodstvo, ali link za preuzimanje ne radi.",
    },
    {
      title: "Promena načina plaćanja",
      description:
        "Želim da umesto kartice plaćam preko računa firme. Šta je potrebno da pošaljem?",
    },
    {
      title: "Pogrešan PIB na računu",
      description: "Na poslednjem računu je pogrešan PIB firme. Molim ispravku i novi račun.",
    },
    {
      title: "Otkazivanje pretplate",
      description: "Želim da otkažem pretplatu od sledećeg meseca. Da li mogu da zadržim podatke?",
    },
  ],
  featureRequest: [
    {
      title: "Predlog: tamna tema",
      description: "Bilo bi odlično kada bi aplikacija imala tamnu temu, posebno za rad uveče.",
    },
    {
      title: "Izvoz tabele u Excel",
      description:
        "Predlažem da se tabela zahteva može izvesti u Excel, da bismo pravili sopstvene izveštaje.",
    },
    {
      title: "Obaveštenja putem emaila",
      description:
        "Voleo bih da dobijem email kad se promeni status mog zahteva, a ne samo obaveštenje u aplikaciji.",
    },
    {
      title: "Filtriranje po datumu",
      description:
        "Bilo bi korisno da lista može da se filtrira po datumu kreiranja, npr. samo prošla nedelja.",
    },
    {
      title: "Prečice na tastaturi",
      description:
        "Predlažem prečice na tastaturi za najčešće radnje, npr. novi zahtev ili pretragu.",
    },
  ],
  other: [
    {
      title: "Pitanje o radnom vremenu podrške",
      description: "Da li podrška radi vikendom i praznicima? Ne mogu to da nađem na sajtu.",
    },
    {
      title: "Uputstvo za nove zaposlene",
      description:
        "Da li postoji kratko uputstvo za korišćenje aplikacije koje mogu da pošaljem novim kolegama?",
    },
    {
      title: "Saradnja i ponuda za firmu",
      description: "Zanima me ponuda za firmu sa 50 korisnika. Kome mogu da se obratim?",
    },
    {
      title: "Pohvala timu podrške",
      description: "Želim samo da pohvalim brz odgovor na moj prethodni zahtev. Hvala vam!",
    },
  ],
};

/** Prvi javni odgovor tima. */
const FIRST_RESPONSES = [
  "Dobar dan, hvala na prijavi. Preuzeo sam zahtev i proveravam šta se dešava.",
  "Pozdrav, hvala što ste nam pisali. Počinjem sa proverom i javljam se uskoro.",
  "Dobar dan, primili smo zahtev. Možete li mi reći od kada se ovo dešava?",
  "Hvala na detaljnom opisu. Prosleđujem tehničkom timu i pratim rešavanje.",
];

/** Pitanje tima korisniku (zahtev prelazi u „Čeka korisnika“). */
const STAFF_QUESTIONS = [
  "Možete li da pošaljete snimak ekrana sa porukom o grešci?",
  "Koji pregledač i koju verziju koristite?",
  "Da li se problem javlja i posle odjave i ponovne prijave?",
  "Molim vas da potvrdite email adresu naloga na kome se ovo dešava.",
];

/** Odgovori korisnika. */
const CUSTOMER_REPLIES = [
  "Evo, poslao sam snimak ekrana. Problem je i dalje tu.",
  "Koristim Chrome, najnoviju verziju. Probao sam i u Firefox-u.",
  "Da, i posle ponovne prijave je isto.",
  "Hvala na brzom odgovoru, čekam dalje informacije.",
  "Potvrđujem, to je moja adresa.",
];

/** Dodatni javni odgovori tima tokom rada. */
const STAFF_UPDATES = [
  "Pronašli smo uzrok i radimo na ispravci.",
  "Ispravka je u pripremi, javiću čim bude spremna.",
  "Proverili smo podešavanja naloga i sve izgleda ispravno. Nastavljamo proveru.",
];

/** Interne beleške tima (korisnik ih ne vidi). */
const INTERNAL_NOTES = [
  "Isti problem prijavila su još dva korisnika, verovatno posle poslednjeg ažuriranja.",
  "Proverio sam logove, greška je na strani servisa za plaćanje.",
  "Prosleđeno razvoju, čeka se ispravka.",
  "Korisnik je već imao sličan zahtev pre mesec dana.",
];

/** Poruka tima pri rešavanju. */
const RESOLUTIONS = [
  "Problem je rešen. Molim vas da proverite i javite ako se ponovi.",
  "Ispravka je objavljena, sada bi trebalo da radi. Hvala na strpljenju!",
  "Podesio sam nalog, sada možete normalno da nastavite. Prijatan dan!",
  "Odgovor na vaše pitanje je u poruci iznad. Zatvaram zahtev, slobodno pišite ponovo.",
];

/** Komentari uz ocenu (po oceni 1–5). */
const RATING_COMMENTS: Record<number, string[]> = {
  1: ["Rešavanje je trajalo predugo."],
  2: ["Problem je rešen, ali tek posle nekoliko dana."],
  3: ["U redu, moglo je brže."],
  4: ["Dobra i ljubazna podrška.", "Hvala, sve radi."],
  5: [
    "Odlično, brzo i jasno!",
    "Svaka čast na brzini.",
    "Hvala puno, problem je rešen za kratko vreme.",
  ],
};

// =============================================================================
// 3. Generator slučajnih brojeva i pomoćne funkcije
// =============================================================================

/**
 * Generator mulberry32: brz, sa početnim brojem, uvek isti niz brojeva.
 * Vraća: funkciju koja daje broj u [0, 1).
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pomoćne funkcije nad jednim generatorom. */
function helpers(random: () => number) {
  return {
    /** Ceo broj u [min, max]. */
    int: (min: number, max: number) => min + Math.floor(random() * (max - min + 1)),
    /** Jedan element niza. */
    pick: <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T,
    /** Element po težinama (npr. [["low", 0.2], ["medium", 0.5]]). */
    weighted: <T,>(items: readonly (readonly [T, number])[]): T => {
      const total = items.reduce((sum, [, weight]) => sum + weight, 0);
      let point = random() * total;
      for (const [item, weight] of items) {
        point -= weight;
        if (point <= 0) return item;
      }
      return items[items.length - 1]![0];
    },
    /** Množilac oko 1 sa „dugim repom“ (log-normalna raspodela), za realna trajanja. */
    spread: (sigma = 0.6) => {
      const u = Math.max(random(), 1e-9);
      const normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
      return Math.exp(normal * sigma);
    },
    /** Broj događaja u danu (Poisson raspodela sa očekivanjem lambda). */
    poisson: (lambda: number) => {
      const limit = Math.exp(-lambda);
      let count = 0;
      let product = random();
      while (product > limit) {
        count += 1;
        product *= random();
      }
      return count;
    },
  };
}

/** Minut i sat u milisekundama. */
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Tipično vreme do prvog odgovora i do rešenja po prioritetu (minuti). */
const FIRST_RESPONSE_MINUTES: Record<TicketPriority, number> = {
  urgent: 25,
  high: 70,
  medium: 180,
  low: 420,
};
const RESOLUTION_MINUTES: Record<TicketPriority, number> = {
  urgent: 6 * 60,
  high: 18 * 60,
  medium: 40 * 60,
  low: 72 * 60,
};

// =============================================================================
// 4. Generisanje podataka (čista funkcija, bez baze)
// =============================================================================

/** Redovi za upis u bazu (oblik tabela iz src/types/database.ts). */
type TicketInsert = Database["public"]["Tables"]["tickets"]["Insert"];
type CommentInsert = Database["public"]["Tables"]["ticket_comments"]["Insert"];
type HistoryInsert = Database["public"]["Tables"]["ticket_history"]["Insert"];
type RatingInsert = Database["public"]["Tables"]["ticket_ratings"]["Insert"];

/** Ceo skup demo podataka. */
export interface DemoData {
  tickets: TicketInsert[];
  comments: CommentInsert[];
  history: HistoryInsert[];
  ratings: RatingInsert[];
}

/** ID demo zahteva: 00000000-0000-4000-8002-0000000000NN (deterministički). */
function demoTicketId(index: number): string {
  return `00000000-0000-4000-8002-${index.toString().padStart(12, "0")}`;
}

/** Trenutak kao ISO tekst za bazu. */
const iso = (time: number) => new Date(time).toISOString();

/**
 * Pravi sve demo zahteve sa komentarima, istorijom i ocenama.
 * Ulaz: trenutak „sada“ (ms) i početni broj generatora.
 * Vraća: redove za upis; sva vremena su pre „sada“.
 */
export function generateDemoData(now: number, seed: number = DEMO_RANDOM_SEED): DemoData {
  const random = createRandom(seed);
  const r = helpers(random);
  const data: DemoData = { tickets: [], comments: [], history: [], ratings: [] };
  const customers = DEMO_USERS.filter((user) => user.role === "customer");
  const todayStart = Math.floor(now / DAY) * DAY;
  let index = 0;

  // Korak 1: dan po dan, od najstarijeg ka danas.
  for (let daysAgo = DEMO_DAYS; daysAgo >= 0; daysAgo -= 1) {
    const dayStart = todayStart - daysAgo * DAY;
    const weekday = new Date(dayStart).getUTCDay();
    const isWeekend = weekday === 0 || weekday === 6;
    // Broj zahteva raste kroz vreme (više korisnika), a vikendom ih je manje.
    const growth = 0.7 + 0.6 * (1 - daysAgo / DEMO_DAYS);
    const count = r.poisson((isWeekend ? 0.35 : 1.05) * growth);

    for (let n = 0; n < count; n += 1) {
      // Korak 2: osnovni podaci zahteva. Vreme: radno vreme (7–17 h UTC ≈ 8–19 h u Beogradu).
      const created = dayStart + r.int(6 * 60, 17 * 60) * MINUTE + r.int(0, 59) * 1000;
      if (created >= now - 10 * MINUTE) continue;
      index += 1;
      const id = demoTicketId(index);
      const customer = r.pick(customers);
      const categoryKey = r.weighted<CategoryKey>([
        ["technical", 0.34],
        ["account", 0.26],
        ["billing", 0.15],
        ["featureRequest", 0.12],
        ["other", 0.13],
      ]);
      const priority = r.weighted<TicketPriority>([
        ["low", 0.22],
        ["medium", 0.45],
        ["high", 0.23],
        ["urgent", 0.1],
      ]);
      const text = r.pick(TICKET_TEXTS[categoryKey]);
      const agent = r.weighted(TEAM.map((member) => [member, member.share] as const));
      const history: HistoryInsert[] = [];
      const comments: CommentInsert[] = [];
      /** Dodaje stavku istorije (redosled čuvaju različita vremena). */
      const log = (
        time: number,
        actor: string | null,
        action: HistoryAction,
        oldValue: Record<string, unknown> | null,
        newValue: Record<string, unknown> | null,
      ) => {
        history.push({
          ticket_id: id,
          actor_id: actor,
          action,
          old_value: oldValue as Json,
          new_value: newValue as Json,
          created_at: iso(time),
        });
      };
      /** Dodaje komentar. */
      const comment = (time: number, author: string, body: string, isInternal = false) => {
        comments.push({
          ticket_id: id,
          author_id: author,
          body,
          is_internal: isInternal,
          created_at: iso(time),
          updated_at: iso(time),
        });
      };

      log(created, customer.id, "created", null, {
        status: "open",
        priority,
        category_id: CATEGORY[categoryKey],
      });

      const ticket: TicketInsert = {
        id,
        title: text.title,
        description: text.description,
        status: "open",
        priority,
        category_id: CATEGORY[categoryKey],
        created_by: customer.id,
        assigned_to: null,
        first_response_at: null,
        resolved_at: null,
        closed_at: null,
        created_at: iso(created),
        updated_at: iso(created),
      };
      let lastEvent = created;

      // Korak 3: mali deo zahteva korisnik sam otkaže pre odgovora.
      if (random() < 0.04) {
        const closed = Math.min(created + r.int(30, 360) * MINUTE, now - MINUTE);
        ticket.status = "closed";
        ticket.closed_at = iso(closed);
        log(closed, customer.id, "status_changed", { status: "open" }, { status: "closed" });
        lastEvent = closed;
      } else {
        // Korak 4: prvi odgovor i preuzimanje (agent preuzima pa odgovara).
        const firstResponse =
          created + FIRST_RESPONSE_MINUTES[priority] * agent.speed * r.spread() * MINUTE;
        // Deo zahteva iz poslednja 3 dana još niko nije preuzeo (red nedodeljenih).
        const waitingInQueue = now - created < 3 * DAY && random() < 0.35;
        if (firstResponse < now && !waitingInQueue) {
          const assigned = Math.max(created + MINUTE, firstResponse - r.int(1, 15) * MINUTE);
          ticket.assigned_to = agent.id;
          log(assigned, agent.id, "assigned", { assigned_to: null }, { assigned_to: agent.id });
          log(
            assigned + 1,
            agent.id,
            "status_changed",
            { status: "open" },
            { status: "in_progress" },
          );
          ticket.status = "in_progress";
          ticket.first_response_at = iso(firstResponse);
          comment(firstResponse, agent.id, r.pick(FIRST_RESPONSES));
          lastEvent = firstResponse;

          // Korak 5: rešenje (posle prvog odgovora) ili rad u toku. Deo zahteva
          // „zastane“ (čeka razvoj, nabavku...) i rešava se nedeljama; predlozi
          // za funkcionalnost češće. Tako i na demo-u uvek ima nerešenih zahteva.
          const stalled = random() < (categoryKey === "featureRequest" ? 0.4 : 0.1);
          const resolution = Math.max(
            firstResponse + 30 * MINUTE,
            created +
              RESOLUTION_MINUTES[priority] *
                agent.speed *
                r.spread(0.7) *
                (stalled ? r.int(10, 50) : 1) *
                MINUTE,
          );
          const end = Math.min(resolution, now - 5 * MINUTE);

          // Korak 6: prepiska između prvog odgovora i kraja (0–5 komentara).
          const extra = r.int(0, 5);
          let waiting = false;
          for (let step = 1; step <= extra; step += 1) {
            const time = firstResponse + ((end - firstResponse) * step) / (extra + 1);
            if (random() < 0.2) {
              comment(time, agent.id, r.pick(INTERNAL_NOTES), true);
            } else if (!waiting && random() < 0.5) {
              // Tim pita korisnika: zahtev čeka korisnika.
              comment(time, agent.id, r.pick(STAFF_QUESTIONS));
              log(
                time + 1,
                agent.id,
                "status_changed",
                { status: "in_progress" },
                { status: "waiting_on_customer" },
              );
              waiting = true;
            } else if (waiting) {
              // Odgovor korisnika vraća zahtev u obradu (kao u bazi: akter je sistem).
              comment(time, customer.id, r.pick(CUSTOMER_REPLIES));
              log(
                time + 1,
                null,
                "status_changed",
                { status: "waiting_on_customer" },
                { status: "in_progress" },
              );
              waiting = false;
            } else {
              comment(time, agent.id, r.pick(STAFF_UPDATES));
            }
            lastEvent = time;
          }

          if (resolution < now - 5 * MINUTE) {
            // Korak 7: rešen zahtev (ako je čekao korisnika, prvo se korisnik javio).
            if (waiting) {
              // Odgovor korisnika na pola puta između poslednjeg komentara i rešenja.
              const reply = Math.round((lastEvent + resolution) / 2);
              comment(reply, customer.id, r.pick(CUSTOMER_REPLIES));
              log(
                reply + 1,
                null,
                "status_changed",
                { status: "waiting_on_customer" },
                { status: "in_progress" },
              );
              lastEvent = reply;
            }
            // Poruka o rešenju neposredno pre promene statusa (posle svih ostalih komentara).
            comment(Math.max(lastEvent + 1000, resolution - MINUTE), agent.id, r.pick(RESOLUTIONS));
            log(
              resolution,
              agent.id,
              "status_changed",
              { status: "in_progress" },
              { status: "resolved" },
            );
            ticket.status = "resolved";
            ticket.resolved_at = iso(resolution);
            lastEvent = resolution;

            // Korak 8: ocena za ~60% rešenih (pretežno 4 i 5; zavisi i od agenta i brzine).
            const ratedAt = resolution + r.int(1, 30) * HOUR;
            if (random() < 0.6 && ratedAt < now) {
              const slow =
                resolution - created > 2 * RESOLUTION_MINUTES[priority] * MINUTE ? -0.5 : 0;
              const bias = agent.ratingBias + slow;
              const score = r.weighted(
                [0.05, 0.07, 0.13, 0.3, 0.45].map(
                  (weight, scoreIndex) =>
                    [scoreIndex + 1, weight * Math.exp(bias * (scoreIndex - 2))] as const,
                ),
              );
              data.ratings.push({
                ticket_id: id,
                rated_by: customer.id,
                score,
                comment: random() < 0.4 ? r.pick(RATING_COMMENTS[score]!) : null,
                created_at: iso(ratedAt),
              });
              log(ratedAt, customer.id, "rated", null, { score });
              lastEvent = ratedAt;
            }

            // Korak 9: većina rešenih se posle 1–4 dana zatvori (potvrda korisnika ili tim).
            const closed = resolution + r.int(24, 96) * HOUR;
            if (closed < now && random() < 0.85) {
              const closer = random() < 0.5 ? customer.id : agent.id;
              log(closed, closer, "status_changed", { status: "resolved" }, { status: "closed" });
              ticket.status = "closed";
              ticket.closed_at = iso(closed);
              lastEvent = Math.max(lastEvent, closed);
            }
          } else if (waiting) {
            ticket.status = "waiting_on_customer";
          }
        }
      }

      // Korak 10: poslednja izmena = poslednji događaj; istorija po vremenu.
      ticket.updated_at = iso(lastEvent);
      history.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      data.tickets.push(ticket);
      data.comments.push(...comments);
      data.history.push(...history);
    }
  }
  // Korak 11: zahtevi po vremenu kreiranja, da brojevi (#) rastu kroz vreme.
  data.tickets.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return data;
}

// =============================================================================
// 5. Upis u bazu (service_role)
// =============================================================================

/** Supabase klijent sa service_role ključem. */
type AdminClient = ReturnType<typeof createClient<Database>>;

/** Prekida skriptu sa jasnom porukom ako upit nije uspeo. */
function check(step: string, error: { message: string } | null): void {
  if (error) throw new Error(`${step}: ${error.message}`);
}

/**
 * Pravi demo naloge koji ne postoje (Supabase Auth) i postavlja im ulogu.
 * Profil pravi triger handle_new_user (uloga customer), pa se agentima
 * uloga menja posle toga.
 */
async function ensureUsers(db: AdminClient): Promise<number> {
  let created = 0;
  for (const user of DEMO_USERS) {
    // Korak 1: nalog postoji? (getUserById vraća grešku ako ne postoji)
    const existing = await db.auth.admin.getUserById(user.id);
    if (!existing.data.user) {
      const { error } = await db.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: user.fullName, locale: "sr" },
      });
      check(`Nalog ${user.email}`, error);
      created += 1;
    }
  }
  // Korak 2: uloga agenta za nove agente.
  const agentIds = DEMO_USERS.filter((user) => user.role === "agent").map((user) => user.id);
  const { error } = await db.from("profiles").update({ role: "agent" }).in("id", agentIds);
  check("Uloga agenta", error);
  return created;
}

/** Upisuje redove u delovima (PostgREST ima ograničenje veličine zahteva). */
async function insertInChunks<T extends keyof Database["public"]["Tables"]>(
  db: AdminClient,
  table: T,
  rows: Database["public"]["Tables"][T]["Insert"][],
): Promise<void> {
  for (let start = 0; start < rows.length; start += 200) {
    const { error } = await db.from(table).insert(rows.slice(start, start + 200) as never);
    check(`Upis u ${table}`, error);
  }
}

/** Glavni tok: nalozi, brisanje starih demo zahteva, novi zahtevi. */
async function main(): Promise<void> {
  // Korak 1: adresa i ključ iz okruženja.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Nedostaje NEXT_PUBLIC_SUPABASE_URL ili SUPABASE_SERVICE_ROLE_KEY (vidi .env.example).",
    );
  }
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Korak 2: nalozi.
  const createdUsers = await ensureUsers(db);

  // Korak 3: brisanje zahteva koje je skripta ranije napravila (kaskadno i
  // komentari, istorija, ocene i obaveštenja).
  const customerIds = DEMO_USERS.filter((user) => user.role === "customer").map((user) => user.id);
  const { error: deleteError } = await db.from("tickets").delete().in("created_by", customerIds);
  check("Brisanje starih demo zahteva", deleteError);

  // Korak 4: novi podaci (zahtevi redom po vremenu, pa brojevi rastu kroz vreme).
  const data = generateDemoData(Date.now());
  await insertInChunks(db, "tickets", data.tickets);
  await insertInChunks(db, "ticket_comments", data.comments);
  await insertInChunks(db, "ticket_history", data.history);
  await insertInChunks(db, "ticket_ratings", data.ratings);

  console.info(
    `Demo podaci: ${createdUsers} novih naloga, ${data.tickets.length} zahteva, ` +
      `${data.comments.length} komentara, ${data.history.length} stavki istorije, ` +
      `${data.ratings.length} ocena.`,
  );
}

// Pokreće se samo kad se fajl izvrši direktno (ne kad ga uveze test).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
