import { XMLParser } from "fast-xml-parser";
import type { ImportStatementPayload } from "@/types/financial";

// Patterns that identify an inbound payment (abono) in a credit card statement
const CREDIT_PATTERNS = [
  /^PAGO (POR|DE|A) /i,
  /^ABONO\b/i,
  /LIQUIDACI[OÓ]N/i,
  /^DEP[OÓ]SITO\b/i,
  /^PAGO A TARJETA/i,
];

function isCredit(descripcion: string): boolean {
  return CREDIT_PATTERNS.some((re) => re.test(descripcion.trim()));
}

interface RawMovimiento {
  "@_fecha": string;
  "@_descripcion": string;
  "@_rfcEnajenante"?: string;
  "@_importe": string;
  "@_moneda"?: string;
  "@_folioOperacion": string;
}

interface RawECB {
  "@_nombreCliente": string;
  "@_numeroCuenta": string;
  "@_periodo": string;
  Movimientos: {
    MovimientoECB?: RawMovimiento[];
    MovimientoECBFiscal?: RawMovimiento[];
  };
}

const PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  // Keep attributes as strings to avoid float-precision loss on large account numbers
  parseAttributeValue: false,
  isArray: (name) => name === "MovimientoECB" || name === "MovimientoECBFiscal",
});

/** Quick check — avoids full parse for non-Santander files */
export function isSantanderECB(xml: string): boolean {
  return xml.includes("http://www.santander.com.mx/schemas/xsd/addendaECB");
}

/**
 * Parses a Santander CFDI v4 with addenda ECB and returns an ImportStatementPayload
 * ready to pass directly to importStatement().
 *
 * Throws with a user-friendly Spanish message on any structural error.
 */
export function parseSantanderECB(xmlContent: string): ImportStatementPayload {
  const doc = PARSER.parse(xmlContent);

  const addenda = doc?.Comprobante?.Addenda;
  if (!addenda) throw new Error("El XML no contiene sección Addenda");

  const addendaECB = addenda?.addendaECB;
  if (!addendaECB) {
    throw new Error("El XML no es un CFDI-ECB de Santander (falta addendaECB)");
  }

  const ecb: RawECB = addendaECB?.EstadoDeCuentaBancario;
  if (!ecb) throw new Error("No se encontró EstadoDeCuentaBancario en la Addenda");

  const numeroCuenta = String(ecb["@_numeroCuenta"]);
  const cutDate = ecb["@_periodo"]; // CFDI emission date = cut date

  const movimientos: RawMovimiento[] = ecb.Movimientos?.MovimientoECB ?? [];
  if (movimientos.length === 0) {
    throw new Error("El XML no contiene movimientos regulares (MovimientoECB)");
  }

  // Derive period from the min/max transaction dates — more reliable than the cutDate
  const sortedDates = movimientos.map((m) => m["@_fecha"]).sort();
  const periodStart = sortedDates[0];
  const periodEnd = sortedDates[sortedDates.length - 1];

  let totalCharges = 0;
  let totalCredits = 0;

  const transactions: ImportStatementPayload["transactions"] = movimientos.map((m) => {
    const importe = parseFloat(m["@_importe"]);
    const credit = isCredit(m["@_descripcion"]);

    if (credit) totalCredits += importe;
    else totalCharges += importe;

    return {
      transactionDate: m["@_fecha"],
      description: m["@_descripcion"],
      reference: m["@_folioOperacion"],
      chargeAmount: credit ? undefined : importe,
      creditAmount: credit ? importe : undefined,
    };
  });

  return {
    account: {
      bankName: "Santander",
      productName: "Tarjeta de Crédito",
      cardNumber: numeroCuenta.slice(-4),
      currency: "MXN",
      type: "CREDIT",
    },
    statement: {
      periodStart,
      periodEnd,
      cutDate,
      totalCharges: Math.round(totalCharges * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
      sourceFile: `santander-ecb-${cutDate}.xml`,
    },
    transactions,
  };
}
