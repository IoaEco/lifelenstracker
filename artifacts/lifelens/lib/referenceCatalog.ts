export interface ReferenceObject {
  id: string;
  label: string;
  description: string;
  lengthMm: number;
  custom?: boolean;
}

export const REFERENCES: ReferenceObject[] = [];

export const CUSTOM_REFERENCE_ID = "custom-mm";

export function getReferenceById(id: string | undefined | null): ReferenceObject | null {
  if (!id) return null;
  return REFERENCES.find((r) => r.id === id) ?? null;
}

export type LengthUnit = "cm" | "mm" | "in" | "m" | "ft";

export function normalizeLengthUnit(unit: string | undefined | null): LengthUnit | null {
  const u = (unit ?? "").toLowerCase().trim();
  if (u === "cm" || u === "centimeter" || u === "centimeters") return "cm";
  if (u === "mm" || u === "millimeter" || u === "millimeters") return "mm";
  if (u === "in" || u === "inch" || u === "inches" || u === '"') return "in";
  if (u === "m" || u === "meter" || u === "meters") return "m";
  if (u === "ft" || u === "foot" || u === "feet" || u === "'") return "ft";
  return null;
}

export function mmToUnit(mm: number, unit: LengthUnit): number {
  switch (unit) {
    case "mm":
      return mm;
    case "cm":
      return mm / 10;
    case "m":
      return mm / 1000;
    case "in":
      return mm / 25.4;
    case "ft":
      return mm / 304.8;
  }
}
