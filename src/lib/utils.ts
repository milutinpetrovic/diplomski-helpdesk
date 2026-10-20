/**
 * Fajl: src/lib/utils.ts
 * Svrha: male pomoćne funkcije koje se koriste u celoj aplikaciji.
 * Koriste ga: sve UI komponente (posebno one iz src/components/ui).
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Spaja Tailwind CSS klase u jedan tekst.
 * Ulaz: proizvoljan broj klasa, uslovnih klasa ili nizova (npr. "p-2", isActive && "font-bold").
 * Vraća: jedan tekst sa klasama, gde kasnija klasa pobeđuje raniju koja je u sukobu
 * (npr. cn("p-2", "p-4") daje "p-4"). Ovo je standardna shadcn/ui funkcija.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
