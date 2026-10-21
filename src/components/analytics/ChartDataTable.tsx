/**
 * Fajl: src/components/analytics/ChartDataTable.tsx
 * Svrha: tabela sa istim podacima kao grafikon, sklopljena ispod njega
 * („Prikaži podatke kao tabelu“). Grafikon se ne može pročitati čitačem
 * ekrana niti razlikovati bez boja, pa tabela daje iste brojeve kao tekst
 * (pristupačnost, NFZ-4).
 * Koriste ga: TicketsTrendChart, ByDimensionChart, CsatChart.
 * Može i na serveru i na klijentu (nema stanja; otvaranje radi <details>).
 */
import { useTranslations } from "next-intl";

/**
 * Sklopljena tabela.
 * Ulaz: nazivi kolona i redovi (prva kolona je naziv reda).
 */
export function ChartDataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) {
  const t = useTranslations("analytics");
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        {t("showTable")}
      </summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-md border">
        <table className="w-full">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className={
                    index === 0
                      ? "px-3 py-2 text-left font-medium"
                      : "px-3 py-2 text-right font-medium"
                  }
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, ...values]) => (
              <tr key={String(label)} className="border-t">
                <th scope="row" className="px-3 py-1.5 text-left font-normal">
                  {label}
                </th>
                {values.map((value, index) => (
                  <td key={index} className="px-3 py-1.5 text-right tabular-nums">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
