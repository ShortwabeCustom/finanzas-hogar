export function resolveReceiptUrl(receipt: string | null | undefined): string | null {
  if (!receipt) return null;
  const value = String(receipt).trim();
  if (!value) return null;

  if (value.startsWith("/uploads/")) {
    const fileName = value.slice("/uploads/".length);
    return `/api/receipt/${encodeURIComponent(fileName)}`;
  }

  return value;
}
