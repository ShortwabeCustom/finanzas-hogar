/**
 * Helpers para manejo de fechas en formularios
 * Convierte entre formato input[type="date"] (yyyy-MM-dd) y otros formatos
 */

/**
 * Convierte una fecha a formato yyyy-MM-dd para input[type="date"]
 */
export function toDateInputValue(
  value: Date | string | null | undefined
): string {
  if (!value) return "";

  try {
    if (value instanceof Date) {
      // Usar UTC para evitar desplazamientos de zona horaria
      const year = value.getUTCFullYear();
      const month = String(value.getUTCMonth() + 1).padStart(2, "0");
      const day = String(value.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    if (typeof value === "string") {
      // Si ya está en formato yyyy-MM-dd, retornar como está
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }

      // Si es ISO string (2026-08-04T00:00:00.000Z), extraer fecha
      if (value.includes("T")) {
        return value.split("T")[0];
      }

      // Si es formato dd/mm/yyyy, convertir
      const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (match) {
        return `${match[3]}-${match[2]}-${match[1]}`;
      }
    }
  } catch (error) {
    console.error("Error converting to date input value:", error, value);
  }

  return "";
}

/**
 * Convierte valor de input[type="date"] a ISO string yyyy-MM-dd
 * Retorna null si está vacío
 */
export function fromDateInputValue(value: string): string | null {
  if (!value || !value.trim()) {
    return null;
  }

  // Validar formato yyyy-MM-dd
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

/**
 * Convierte valor de input[type="date"] a objeto Date
 * Usa UTC para evitar desplazamientos de zona horaria
 */
export function fromDateInputToDate(value: string): Date | null {
  if (!value || !value.trim()) {
    return null;
  }

  // Validar formato yyyy-MM-dd
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-");
  return new Date(`${year}-${month}-${day}T00:00:00Z`);
}

/**
 * Valida que una fecha en formato input[type="date"] sea válida
 */
export function isValidDateInputValue(value: string): boolean {
  if (!value) return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !isNaN(date.getTime());
}

/**
 * Obtiene la fecha de hoy en formato yyyy-MM-dd
 */
export function getTodayDateInputValue(): string {
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = String(today.getUTCMonth() + 1).padStart(2, "0");
  const day = String(today.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Obtiene una fecha futura (ej. 30 días después) en formato yyyy-MM-dd
 */
export function getFutureDateInputValue(days: number): string {
  const future = new Date();
  future.setUTCDate(future.getUTCDate() + days);
  const year = future.getUTCFullYear();
  const month = String(future.getUTCMonth() + 1).padStart(2, "0");
  const day = String(future.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
