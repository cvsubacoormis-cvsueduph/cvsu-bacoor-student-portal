/**
 * Formats a date value (Date, number, or string) for display.
 * Handles Date objects, ISO strings (from JSON deserialization after Redis caching),
 * and Unix timestamps in milliseconds.
 */
export function formatDate(value: Date | number | string | null | undefined): string {
  if (value == null) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

export function formatDateTime(value: Date | number | string | null | undefined): string {
  if (value == null) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleString();
}
