// ─── ENUMS ─────────────────────────────────────────────────────────────────────

export type AccountType = "CHECKING" | "CREDIT";

// ─── MODEL SHAPES ──────────────────────────────────────────────────────────────

export interface BankAccount {
  id: string;
  userId: string;
  bankName: string;
  productName: string;
  accountNumber: string | null;
  clabe: string | null;
  cardNumber: string | null;
  currency: string;
  type: AccountType;
  active: boolean;
  createdAt: Date;
}

export interface BankStatement {
  id: string;
  accountId: string;
  periodStart: Date;
  periodEnd: Date;
  cutDate: Date | null;
  openingBalance: number | null;
  closingBalance: number | null;
  totalCharges: number | null;
  totalCredits: number | null;
  sourceFile: string | null;
  importedAt: Date;
}

export interface BankTransaction {
  id: string;
  statementId: string;
  accountId: string;
  transactionDate: Date;
  description: string;
  reference: string | null;
  chargeAmount: number | null;
  creditAmount: number | null;
  balance: number | null;
  category: string | null;
  rawOcrText: string | null;
  createdAt: Date;
}

// ─── IMPORT PAYLOAD ────────────────────────────────────────────────────────────

export interface ImportStatementPayload {
  account: {
    bankName: string;
    productName: string;
    accountNumber?: string;
    clabe?: string;
    cardNumber?: string;
    currency?: string;
    type: AccountType;
  };
  statement: {
    periodStart: string; // "YYYY-MM-DD"
    periodEnd: string;   // "YYYY-MM-DD"
    cutDate?: string;    // "YYYY-MM-DD"
    openingBalance?: number;
    closingBalance?: number;
    totalCharges?: number;
    totalCredits?: number;
    sourceFile?: string;
  };
  transactions: Array<{
    transactionDate: string; // "YYYY-MM-DD"
    description: string;
    reference?: string;
    chargeAmount?: number;
    creditAmount?: number;
    balance?: number;
    rawOcrText?: string;
  }>;
}

export interface ImportSummary {
  imported: number;
  skipped: number;
  errors: string[];
}
