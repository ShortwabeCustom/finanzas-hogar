import { z } from "zod";

export const debtFormSchema = z.object({
  direction: z.enum(["PAYABLE", "RECEIVABLE"]).refine(
    (val) => val !== undefined,
    { message: "Selecciona si es deuda a pagar o a cobrar" }
  ),
  type: z.enum([
    "PERSONAL_LOAN",
    "CREDIT_CARD",
    "AUTO_LOAN",
    "MORTGAGE",
    "BNPL",
    "FAMILY_LOAN",
    "LOAN_GRANTED",
    "OTHER",
  ]),
  name: z.string().min(2, "Mínimo 2 caracteres").max(100),
  counterpartyName: z.string().min(2, "Mínimo 2 caracteres").max(100).optional().nullable(),
  originalPrincipal: z.coerce
    .number()
    .positive("El monto debe ser mayor que cero"),
  currentPrincipal: z.coerce
    .number()
    .nonnegative("El saldo no puede ser negativo"),
  annualInterestRate: z.coerce
    .number()
    .nonnegative("La tasa no puede ser negativa")
    .max(999.9999, "Tasa inválida")
    .optional()
    .nullable(),
  scheduleMode: z.enum(["FREE", "INSTALLMENTS"]),
  paymentFrequency: z
    .enum(["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"])
    .optional()
    .nullable(),
  scheduledPayment: z.coerce
    .number()
    .positive("El monto debe ser mayor que cero")
    .optional()
    .nullable(),
  numberOfInstallments: z.coerce
    .number()
    .int()
    .positive("Número de cuotas debe ser mayor que cero")
    .optional()
    .nullable(),
  startDate: z.string().date("Fecha inválida"),
  estimatedEndDate: z.string().date("Fecha inválida").optional().nullable(),
  personalCardId: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  agreementUrl: z.string().url("URL inválida").optional().nullable(),
});

export type DebtFormInput = z.infer<typeof debtFormSchema>;

export const debtPaymentSchema = z
  .object({
    paidAt: z.string().date("Fecha inválida"),
    principalAmount: z.coerce
      .number()
      .nonnegative("El capital no puede ser negativo"),
    interestAmount: z.coerce
      .number()
      .nonnegative("El interés no puede ser negativo")
      .default(0),
    feeAmount: z.coerce
      .number()
      .nonnegative("Las comisiones no pueden ser negativas")
      .default(0),
    penaltyAmount: z.coerce
      .number()
      .nonnegative("Las penalizaciones no pueden ser negativas")
      .default(0),
    paymentMethod: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "TRANSFER", "CHECK", "OTHER"]),
    personalCardId: z.string().optional().nullable(),
    installmentId: z.string().optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
  })
  .refine(
    (data) => {
      const total = data.principalAmount + data.interestAmount + data.feeAmount + data.penaltyAmount;
      return total > 0;
    },
    {
      message: "El monto total debe ser mayor que cero",
      path: ["principalAmount"],
    }
  );

export type DebtPaymentInput = z.infer<typeof debtPaymentSchema>;

export const linkTransactionSchema = z.object({
  debtId: z.string().min(1, "Deuda requerida"),
  installmentId: z.string().optional().nullable(),
  principalAmount: z.coerce.number().nonnegative("Capital no puede ser negativo"),
  interestAmount: z.coerce.number().nonnegative("Interés no puede ser negativo").default(0),
  feeAmount: z.coerce.number().nonnegative("Comisión no puede ser negativa").default(0),
  penaltyAmount: z.coerce.number().nonnegative("Penalización no puede ser negativa").default(0),
  notes: z.string().max(500).optional().nullable(),
});

export type LinkTransactionInput = z.infer<typeof linkTransactionSchema>;

export const generateInstallmentsSchema = z.object({
  numberOfInstallments: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 cuota")
    .max(360, "Máximo 360 cuotas"),
  firstPaymentDate: z.string().date("Fecha inválida"),
  paymentFrequency: z.enum(["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]),
});

export type GenerateInstallmentsInput = z.infer<typeof generateInstallmentsSchema>;
