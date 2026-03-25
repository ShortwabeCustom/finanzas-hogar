export interface PurchaseHistoryEntry {
  purchaseDate: Date;
  daysElapsed: number | null;
}

export interface ProductMetrics {
  purchaseCount: number;
  lastPurchaseDate: string | null;
  lastDaysElapsed: number | null;
  avgDaysElapsed: number | null;
  nextPurchaseDate: string | null;
  daysUntilNext: number | null;
  /** "on_time" | "soon" | "overdue" | "no_history" | "no_purchases" */
  status: "on_time" | "soon" | "overdue" | "no_history" | "no_purchases";
}

export function computeMetrics(history: PurchaseHistoryEntry[]): ProductMetrics {
  if (history.length === 0) {
    return {
      purchaseCount: 0,
      lastPurchaseDate: null,
      lastDaysElapsed: null,
      avgDaysElapsed: null,
      nextPurchaseDate: null,
      daysUntilNext: null,
      status: "no_purchases",
    };
  }

  const sorted = [...history].sort(
    (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
  );

  const lastPurchaseDate = new Date(sorted[0].purchaseDate).toISOString();

  const elapsedValues = sorted
    .map((h) => h.daysElapsed)
    .filter((d): d is number => d !== null);

  const lastDaysElapsed = elapsedValues.length > 0 ? elapsedValues[0] : null;

  const avgDaysElapsed =
    elapsedValues.length > 0
      ? Math.round(elapsedValues.reduce((a, b) => a + b, 0) / elapsedValues.length)
      : null;

  if (avgDaysElapsed === null) {
    return {
      purchaseCount: history.length,
      lastPurchaseDate,
      lastDaysElapsed,
      avgDaysElapsed: null,
      nextPurchaseDate: null,
      daysUntilNext: null,
      status: "no_history",
    };
  }

  const nextDate = new Date(
    new Date(sorted[0].purchaseDate).getTime() + avgDaysElapsed * 24 * 60 * 60 * 1000
  );
  const nextPurchaseDate = nextDate.toISOString();
  const daysUntilNext = Math.round(
    (nextDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );

  let status: ProductMetrics["status"];
  if (daysUntilNext > 7) status = "on_time";
  else if (daysUntilNext >= 0) status = "soon";
  else status = "overdue";

  return {
    purchaseCount: history.length,
    lastPurchaseDate,
    lastDaysElapsed,
    avgDaysElapsed,
    nextPurchaseDate,
    daysUntilNext,
    status,
  };
}
