/** Clean date for UI/PDF — never use String(date) (shows GMT+0600 timezone text). */
export function formatDisplayDate(value?: string | Date | null): string {
  if (value == null || value === "") return "—";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    const isoDate = String(value).split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      const [y, m, d] = isoDate.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    return String(value);
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShortDate(value?: string | Date | null): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB");
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).split("T")[0] || "—";
  return date.toLocaleDateString("en-GB");
}
