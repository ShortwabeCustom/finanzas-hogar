import { z } from "zod";

// ─── AUTH ──────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

// ─── PAYMENTS ──────────────────────────────────────────────────────────────────

export const paymentSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  concept: z.string().min(2, "Mínimo 2 caracteres"),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  amount: z.coerce.number().positive("El monto debe ser positivo"),
  paymentDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  period: z.enum(["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]),
  status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELLED"]),
  paymentMethod: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "TRANSFER", "CHECK", "OTHER"]),
  paidById: z.string().optional().nullable(),
  personalCardId: z.string().optional().nullable(),
  receipt: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

// ─── CATEGORIES ────────────────────────────────────────────────────────────────

export const categorySchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido"),
  icon: z.string().optional().nullable(),
  type: z.enum(["PAYMENT", "PANTRY", "BOTH"]),
});

export type CategoryInput = z.infer<typeof categorySchema>;

// ─── PANTRY ────────────────────────────────────────────────────────────────────

const priceField = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  },
  z.number().nonnegative("No puede ser negativo").nullable()
).optional();

export const pantryItemSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  price: priceField,
  purchaseDate: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
  // Preserved internally — not shown in form
  quantity: z.coerce.number().nonnegative().optional().default(1),
  unit: z.enum(["PCS", "KG", "G", "L", "ML", "PKG", "BOX", "CAN", "BOTTLE", "DOZEN"]).optional().default("PCS"),
  minStock: z.coerce.number().nonnegative().optional().default(1),
  expiryDate: z.string().optional().nullable(),
});

export type PantryItemInput = z.infer<typeof pantryItemSchema>;

// ─── USERS ─────────────────────────────────────────────────────────────────────

export const userSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres").optional().or(z.literal("")),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
  active: z.boolean(),
});

export type UserInput = z.infer<typeof userSchema>;

// ─── PERSONAL FINANCES ─────────────────────────────────────────────────────────

export const personalCategorySchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido"),
  type: z.enum(["PAYMENT", "PANTRY", "BOTH"]),
  active: z.boolean().optional().default(true),
});

export type PersonalCategoryInput = z.infer<typeof personalCategorySchema>;

export const personalPaymentSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  concept: z.string().min(2, "Mínimo 2 caracteres"),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  amount: z.coerce.number().positive("El monto debe ser positivo"),
  period: z.enum(["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"]),
  status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELLED"]),
  paymentMethod: z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "TRANSFER", "CHECK", "OTHER"]),
  personalCardId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  paymentDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type PersonalPaymentInput = z.infer<typeof personalPaymentSchema>;

// ─── PERSONAL CARDS ────────────────────────────────────────────────────────────

export const personalCardSchema = z.object({
  bankName: z.string().min(2, "Mínimo 2 caracteres"),
  cardName: z.string().min(2, "Mínimo 2 caracteres"),
  last4Digits: z.string().regex(/^\d{4}$/, "Deben ser exactamente 4 dígitos numéricos"),
  paymentSourceType: z.enum(["CREDIT_CARD", "DEBIT_CARD", "BANK_ACCOUNT"]).default("CREDIT_CARD"),
  closingDay: z.coerce.number().int().min(0, "Día inválido").max(31, "Día inválido"),
  dueDay: z.coerce.number().int().min(0, "Día inválido").max(31, "Día inválido"),
  active: z.boolean().optional().default(true),
});

export type PersonalCardInput = z.infer<typeof personalCardSchema>;

// ─── PRODUCTS ──────────────────────────────────────────────────────────────────

export const productCategorySchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido"),
  active: z.boolean().optional().default(true),
});

export type ProductCategoryInput = z.infer<typeof productCategorySchema>;

export const productSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  categoryId: z.string().min(1, "Selecciona una categoría"),
  active: z.boolean().optional().default(true),
});

export type ProductInput = z.infer<typeof productSchema>;

export const productPurchaseSchema = z.object({
  purchaseDate: z.string().min(1, "La fecha es requerida"),
  notes: z.string().optional().nullable(),
  price: priceField,
});

export type ProductPurchaseInput = z.infer<typeof productPurchaseSchema>;
