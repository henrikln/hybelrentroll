export function formatNOK(value: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNOKShort(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${millions.toFixed(2).replace(".", ",")} mill.`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return formatNOK(value);
}

export function formatArea(sqm: number): string {
  return `${new Intl.NumberFormat("nb-NO").format(sqm)} m²`;
}

export function formatDecimal(value: number, decimals = 1): string {
  return value.toFixed(decimals).replace(".", ",");
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function parseNorwegianDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split(".");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
}

export function parseNorwegianNumber(value: string | number): number | null {
  if (typeof value === "number") return value;
  if (!value || value === "") return null;
  const cleaned = String(value).replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}
