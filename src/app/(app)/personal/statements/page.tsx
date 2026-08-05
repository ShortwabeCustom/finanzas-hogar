"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Header from "@/components/layout/Header";
import ApiErrorState from "@/components/ui/ApiErrorState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import StatementImportCard from "@/components/statements/StatementImportCard";
import LinkTransactionModal from "@/components/personal/debts/LinkTransactionModal";
import { formatCurrency, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

interface BankAccount {
  id: string;
  bankName: string;
  productName: string;
  cardNumber: string | null;
  accountNumber: string | null;
  type: "CHECKING" | "CREDIT";
  currency: string;
}

interface BankStatement {
  id: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number | null;
  closingBalance: number | null;
  totalCharges: number | null;
  totalCredits: number | null;
  sourceFile: string | null;
  account: BankAccount;
  assignedMonth: number | null;
  assignedYear: number | null;
  assignedMonthSource: string | null;
}

interface BankTransaction {
  id: string;
  transactionDate: string;
  description: string;
  reference: string | null;
  chargeAmount: number | null;
  creditAmount: number | null;
  balance: number | null;
  category: string | null;
  personalPayment: { id: string; folio: string } | null;
}

interface TxnDraft {
  transactionDate: string;
  description: string;
  reference: string;
  chargeAmount: string;
  creditAmount: string;
  balance: string;
}

interface AccountEditForm {
  bankName: string;
  productName: string;
  cardNumber: string;
  type: "CHECKING" | "CREDIT";
}

type SortField = "date" | "charge";
type SortDirection = "asc" | "desc";

const EMPTY_DRAFT: TxnDraft = {
  transactionDate: "",
  description: "",
  reference: "",
  chargeAmount: "",
  creditAmount: "",
  balance: "",
};

function periodLabel(s: BankStatement): string {
  if (s.assignedMonthSource === "manual" && s.assignedMonth != null && s.assignedYear != null) {
    const d = new Date(s.assignedYear, s.assignedMonth - 1, 1);
    return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  }
  const d = new Date(s.periodEnd.slice(0, 10) + "T12:00:00");
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function autoPeriodLabel(periodEnd: string): string {
  const d = new Date(periodEnd.slice(0, 10) + "T12:00:00");
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function maskedCardSuffix(cardNumber: string | null): string {
  if (!cardNumber) return "";
  const digits = cardNumber.replace(/\D/g, "");
  return ` ••••${(digits || cardNumber).slice(-4)}`;
}

function accountLabel(acc: BankAccount): string {
  return `${acc.bankName} ${acc.productName}${maskedCardSuffix(acc.cardNumber)}`;
}

function txnToDraft(t: BankTransaction): TxnDraft {
  return {
    transactionDate: t.transactionDate.slice(0, 10),
    description: t.description,
    reference: t.reference ?? "",
    chargeAmount: t.chargeAmount != null && Number(t.chargeAmount) !== 0 ? String(t.chargeAmount) : "",
    creditAmount: t.creditAmount != null && Number(t.creditAmount) !== 0 ? String(t.creditAmount) : "",
    balance: t.balance != null ? String(t.balance) : "",
  };
}

function draftToPayload(d: TxnDraft) {
  return {
    transactionDate: d.transactionDate,
    description: d.description,
    reference: d.reference || null,
    chargeAmount: d.chargeAmount ? parseFloat(d.chargeAmount) : null,
    creditAmount: d.creditAmount ? parseFloat(d.creditAmount) : null,
    balance: d.balance ? parseFloat(d.balance) : null,
  };
}

/** Shared inline-edit input style */
const editInput = "w-full border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500";

interface MoveStatementModalProps {
  statement: BankStatement | null;
  accounts: BankAccount[];
  targetAccountId: string;
  mergeIfPeriodExists: boolean;
  loading: boolean;
  error: string | null;
  onTargetAccountChange: (accountId: string) => void;
  onMergeIfPeriodExistsChange: (merge: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
}

function MoveStatementModal({
  statement,
  accounts,
  targetAccountId,
  mergeIfPeriodExists,
  loading,
  error,
  onTargetAccountChange,
  onMergeIfPeriodExistsChange,
  onClose,
  onSubmit,
}: MoveStatementModalProps) {
  return (
    <Modal open={!!statement} onClose={onClose} title="Mover estado" size="md">
      {statement && (
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Origen</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{accountLabel(statement.account)}</p>
            <p className="text-sm capitalize text-gray-500">{periodLabel(statement)}</p>
          </div>

          <div className="space-y-1">
            <label htmlFor="move-target-account" className="text-sm font-medium text-gray-700">Cuenta destino</label>
            <select
              id="move-target-account"
              className="input w-full"
              value={targetAccountId}
              onChange={(e) => onTargetAccountChange(e.target.value)}
              disabled={loading}
            >
              {accounts
                .filter((account) => account.id !== statement.accountId)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {accountLabel(account)}
                  </option>
                ))}
            </select>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-3 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={mergeIfPeriodExists}
              onChange={(e) => onMergeIfPeriodExistsChange(e.target.checked)}
              disabled={loading}
            />
            <span>Fusionar si el periodo ya existe</span>
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {accounts.length < 2 && (
            <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Necesitas al menos dos cuentas para mover estados.
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="btn-primary"
              disabled={loading || !targetAccountId}
            >
              {loading
                ? <span className="flex items-center gap-2"><span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />Moviendo...</span>
                : "Mover estado"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

interface MergeAccountsModalProps {
  sourceAccount: BankAccount | null;
  accounts: BankAccount[];
  targetAccountId: string;
  loading: boolean;
  error: string | null;
  onTargetAccountChange: (accountId: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

function MergeAccountsModal({
  sourceAccount,
  accounts,
  targetAccountId,
  loading,
  error,
  onTargetAccountChange,
  onClose,
  onSubmit,
}: MergeAccountsModalProps) {
  return (
    <Modal open={!!sourceAccount} onClose={onClose} title="Fusionar cuentas" size="md">
      {sourceAccount && (
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Cuenta origen</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{accountLabel(sourceAccount)}</p>
          </div>

          <div className="space-y-1">
            <label htmlFor="merge-target-account" className="text-sm font-medium text-gray-700">Cuenta destino</label>
            <select
              id="merge-target-account"
              className="input w-full"
              value={targetAccountId}
              onChange={(e) => onTargetAccountChange(e.target.value)}
              disabled={loading}
            >
              {accounts
                .filter((account) => account.id !== sourceAccount.id)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {accountLabel(account)}
                  </option>
                ))}
            </select>
          </div>

          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            Esta acción moverá todos los periodos y eliminará la cuenta origen si queda vacía.
          </p>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {accounts.length < 2 && (
            <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Necesitas al menos dos cuentas para fusionar.
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="btn-primary"
              disabled={loading || !targetAccountId}
            >
              {loading
                ? <span className="flex items-center gap-2"><span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />Fusionando...</span>
                : "Fusionar cuentas"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SortButton({
  field, label, currentField, direction, onSort,
}: {
  field: SortField;
  label: string;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentField === field;
  const fieldLabel = field === "date" ? "fecha" : "cargo";
  const nextDir = isActive ? (direction === "desc" ? "ascendente" : "descendente") : "descendente";
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      aria-label={`Ordenar por ${fieldLabel} ${nextDir}`}
      className={`inline-flex items-center gap-1 transition-colors ${isActive ? "text-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
    >
      <span>{label}</span>
      <svg
        className={`w-3 h-3 transition-transform ${isActive && direction === "asc" ? "rotate-180" : ""} ${isActive ? "opacity-100" : "opacity-40"}`}
        fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

export default function StatementsPage() {
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selectedStatement, setSelectedStatement] = useState<BankStatement | null>(null);
  const [loadingStatements, setLoadingStatements] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [statementsError, setStatementsError] = useState<string | null>(null);
  const [txnsError, setTxnsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "charge" | "credit">("");
  const [showImport, setShowImport] = useState(false);
  const [organizeMode, setOrganizeMode] = useState(false);
  const [deletingStatement, setDeletingStatement] = useState<BankStatement | null>(null);
  const [deletingStatementLoading, setDeletingStatementLoading] = useState(false);

  // Organize statements/accounts
  const [moveStatement, setMoveStatement] = useState<BankStatement | null>(null);
  const [moveTargetAccountId, setMoveTargetAccountId] = useState("");
  const [mergeIfPeriodExists, setMergeIfPeriodExists] = useState(false);
  const [movingStatement, setMovingStatement] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [mergeSourceAccount, setMergeSourceAccount] = useState<BankAccount | null>(null);
  const [mergeTargetAccountId, setMergeTargetAccountId] = useState("");
  const [mergingAccounts, setMergingAccounts] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  // Inline edit (desktop)
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TxnDraft>(EMPTY_DRAFT);
  const [savingTxn, setSavingTxn] = useState(false);

  // Add new row
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [newDraft, setNewDraft] = useState<TxnDraft>(EMPTY_DRAFT);

  // Mobile modal (edit + add)
  const [mobileTxn, setMobileTxn] = useState<BankTransaction | "new" | null>(null);
  const [mobileDraft, setMobileDraft] = useState<TxnDraft>(EMPTY_DRAFT);

  // Selection & send-to-payments
  const [selectedTxnIds, setSelectedTxnIds] = useState<Set<string>>(new Set());
  const [sendingToPayments, setSendingToPayments] = useState(false);
  const [sentFilter, setSentFilter] = useState<"" | "not_sent" | "sent">("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Edit assigned month modal
  const [editingPeriodStatement, setEditingPeriodStatement] = useState<BankStatement | null>(null);
  const [periodEditMonth, setPeriodEditMonth] = useState("1");
  const [periodEditYear, setPeriodEditYear] = useState(String(new Date().getFullYear()));
  const [savingPeriod, setSavingPeriod] = useState(false);

  // Edit account modal
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [accountForm, setAccountForm] = useState<AccountEditForm>({
    bankName: "", productName: "", cardNumber: "", type: "CREDIT",
  });
  const [savingAccount, setSavingAccount] = useState(false);
  const [saveAccountError, setSaveAccountError] = useState<string | null>(null);

  // Link transaction to debt
  const [debts, setDebts] = useState<any[]>([]);
  const [linkingTransaction, setLinkingTransaction] = useState<BankTransaction | null>(null);
  const [unlinkedOnlyFilter, setUnlinkedOnlyFilter] = useState(false);

  const loadStatements = useCallback(async (preferredStatementId?: string | null) => {
    setLoadingStatements(true);
    setStatementsError(null);
    try {
      const res = await fetch("/api/personal/statements");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const sorted = (Array.isArray(d) ? d : []).sort(
        (a: BankStatement, b: BankStatement) =>
          new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime()
      );
      setStatements(sorted);
      setSelectedStatement((current) => {
        const preferred = preferredStatementId
          ? sorted.find((statement) => statement.id === preferredStatementId)
          : null;
        if (preferred) return preferred;
        if (current) return sorted.find((statement) => statement.id === current.id) ?? sorted[0] ?? null;
        return sorted[0] ?? null;
      });
    } catch {
      setStatementsError("No se pudieron cargar los estados de cuenta.");
    } finally {
      setLoadingStatements(false);
    }
  }, []);

  const loadDebts = useCallback(async () => {
    try {
      const res = await fetch("/api/personal/debts");
      if (res.ok) {
        const data = await res.json();
        setDebts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error loading debts:", error);
    }
  }, []);

  useEffect(() => {
    loadStatements();
    loadDebts();
  }, [loadStatements, loadDebts]);

  const fetchTransactions = useCallback(async () => {
    if (!selectedStatement) {
      setTransactions([]);
      setTxnsError(null);
      setLoadingTxns(false);
      return;
    }
    setLoadingTxns(true);
    setTxnsError(null);
    const params = new URLSearchParams({ accountId: selectedStatement.accountId });
    params.set("date_from", selectedStatement.periodStart.slice(0, 10));
    params.set("date_to", selectedStatement.periodEnd.slice(0, 10));
    if (typeFilter) params.set("type", typeFilter);
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/financial/transactions?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setTransactions(Array.isArray(d) ? d : []);
    } catch {
      setTxnsError("No se pudieron cargar las transacciones de este período.");
    } finally {
      setLoadingTxns(false);
    }
  }, [selectedStatement, typeFilter, search]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Limpiar selección al cambiar de período
  useEffect(() => {
    setSelectedTxnIds(new Set());
    setSentFilter("");
  }, [selectedStatement?.id]);

  const statementsByAccount = useMemo(() => {
    const map = new Map<string, { account: BankAccount; statements: BankStatement[] }>();
    for (const s of statements) {
      if (!map.has(s.accountId)) map.set(s.accountId, { account: s.account, statements: [] });
      map.get(s.accountId)!.statements.push(s);
    }
    return Array.from(map.values());
  }, [statements]);

  const accountOptions = useMemo(
    () => statementsByAccount.map(({ account }) => account),
    [statementsByAccount]
  );

  const totalCharges = transactions.reduce((s, t) => s + Number(t.chargeAmount ?? 0), 0);
  const totalCredits = transactions.reduce((s, t) => s + Number(t.creditAmount ?? 0), 0);

  // Transacciones filtradas por estado de envío (cliente) y deudas
  const visibleTransactions = useMemo(() => {
    let result = transactions;

    if (sentFilter === "sent") result = result.filter((t) => !!t.personalPayment);
    if (sentFilter === "not_sent") result = result.filter((t) => !t.personalPayment);

    if (unlinkedOnlyFilter) result = result.filter((t) => !t.personalPayment);

    return result;
  }, [transactions, sentFilter, unlinkedOnlyFilter]);

  // Solo las visibles y seleccionables (sin pago vinculado)
  const selectableTransactions = useMemo(
    () => visibleTransactions.filter((t) => !t.personalPayment),
    [visibleTransactions]
  );
  const allSelectableSelected =
    selectableTransactions.length > 0 &&
    selectableTransactions.every((t) => selectedTxnIds.has(t.id));
  const someSelectableSelected = selectableTransactions.some((t) => selectedTxnIds.has(t.id));

  // Seleccionadas que son visibles actualmente
  const activeSelection = useMemo(
    () => visibleTransactions.filter((t) => selectedTxnIds.has(t.id)),
    [visibleTransactions, selectedTxnIds]
  );
  const selectionCharges = activeSelection.reduce((s, t) => s + Number(t.chargeAmount ?? 0), 0);
  const selectionCredits = activeSelection.reduce((s, t) => s + Number(t.creditAmount ?? 0), 0);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }

  const sortedTransactions = useMemo(() => {
    return [...visibleTransactions].sort((a, b) => {
      if (sortField === "date") {
        const tA = new Date(a.transactionDate).getTime();
        const tB = new Date(b.transactionDate).getTime();
        if (tA !== tB) return sortDirection === "desc" ? tB - tA : tA - tB;
        const refCmp = (a.reference ?? "").localeCompare(b.reference ?? "");
        if (refCmp !== 0) return refCmp;
        return a.id.localeCompare(b.id);
      }
      const cA = a.chargeAmount != null && Number(a.chargeAmount) !== 0 ? Number(a.chargeAmount) : null;
      const cB = b.chargeAmount != null && Number(b.chargeAmount) !== 0 ? Number(b.chargeAmount) : null;
      if (cA === null && cB === null) return 0;
      if (cA === null) return 1;
      if (cB === null) return -1;
      return sortDirection === "desc" ? cB - cA : cA - cB;
    });
  }, [visibleTransactions, sortField, sortDirection]);

  // ── Send to Mis Pagos ─────────────────────────────────────
  async function handleSendToPayments() {
    const ids = activeSelection.map((t) => t.id);
    if (ids.length === 0) return;
    setSendingToPayments(true);
    try {
      const res = await fetch("/api/personal/payments/from-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds: ids, defaults: { status: "PAID", period: "ONCE" } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudieron enviar los movimientos");

      setSelectedTxnIds(new Set());
      await fetchTransactions();

      const { created = 0, skippedDuplicates = 0 } = data;
      if (created > 0 && skippedDuplicates > 0) {
        toast.success(
          <span>
            {created} pago{created !== 1 ? "s" : ""} creado{created !== 1 ? "s" : ""} correctamente.{" "}
            {skippedDuplicates} omitido{skippedDuplicates !== 1 ? "s" : ""} por duplicado.{" "}
            <a href="/personal/payments" className="underline font-semibold">Ver en Mis Pagos</a>
          </span>,
          { duration: 5000 }
        );
      } else if (created > 0) {
        toast.success(
          <span>
            {created} pago{created !== 1 ? "s" : ""} creado{created !== 1 ? "s" : ""} correctamente.{" "}
            <a href="/personal/payments" className="underline font-semibold">Ver en Mis Pagos</a>
          </span>,
          { duration: 5000 }
        );
      } else {
        toast(`${skippedDuplicates} movimiento${skippedDuplicates !== 1 ? "s" : ""} ya estaba${skippedDuplicates !== 1 ? "n" : ""} en Mis Pagos`, { icon: "ℹ️" });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Error al enviar movimientos";
      toast.error(msg);
    } finally {
      setSendingToPayments(false);
    }
  }

  // ── Organize statements/accounts ─────────────────────────
  function openMoveStatement(statement: BankStatement) {
    const target = accountOptions.find((account) => account.id !== statement.accountId);
    setMoveStatement(statement);
    setMoveTargetAccountId(target?.id ?? "");
    setMergeIfPeriodExists(false);
    setMoveError(null);
  }

  function openMergeAccount(account: BankAccount) {
    const target = accountOptions.find((option) => option.id !== account.id);
    setMergeSourceAccount(account);
    setMergeTargetAccountId(target?.id ?? "");
    setMergeError(null);
  }

  async function handleMoveStatement() {
    if (!moveStatement || !moveTargetAccountId) return;
    setMovingStatement(true);
    setMoveError(null);
    try {
      const res = await fetch(`/api/personal/statements/${moveStatement.id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAccountId: moveTargetAccountId,
          mergeIfPeriodExists,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo mover el estado de cuenta");
      }

      setMoveStatement(null);
      toast.success("Estado de cuenta movido correctamente");
      await loadStatements(data.targetStatementId ?? moveStatement.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo mover el estado de cuenta";
      setMoveError(message);
      toast.error(message);
    } finally {
      setMovingStatement(false);
    }
  }

  async function handleMergeAccounts() {
    if (!mergeSourceAccount || !mergeTargetAccountId) return;
    setMergingAccounts(true);
    setMergeError(null);
    try {
      const res = await fetch("/api/personal/accounts/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceAccountId: mergeSourceAccount.id,
          targetAccountId: mergeTargetAccountId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudieron fusionar las cuentas");
      }

      setMergeSourceAccount(null);
      toast.success("Cuentas fusionadas correctamente");
      await loadStatements();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudieron fusionar las cuentas";
      setMergeError(message);
      toast.error(message);
    } finally {
      setMergingAccounts(false);
    }
  }

  async function handleDeleteStatement() {
    if (!deletingStatement) return;
    setDeletingStatementLoading(true);
    try {
      const res = await fetch(`/api/personal/statements/${deletingStatement.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo eliminar el estado de cuenta");
      }

      const deletedId = deletingStatement.id;
      const deletedPeriod = periodLabel(deletingStatement);
      setDeletingStatement(null);
      setEditingTxnId(null);
      setIsAddingRow(false);
      setMobileTxn(null);

      if (selectedStatement?.id === deletedId) {
        setSelectedStatement(null);
        setTransactions([]);
        setSearch("");
        setTypeFilter("");
      }

      toast.success(`Estado de cuenta de ${deletedPeriod} eliminado`);
      await loadStatements();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar el estado de cuenta";
      toast.error(message);
    } finally {
      setDeletingStatementLoading(false);
    }
  }

  // ── Edit assigned month ───────────────────────────────────
  function openEditPeriod(s: BankStatement) {
    const autoEnd = new Date(s.periodEnd.slice(0, 10) + "T12:00:00");
    const month = s.assignedMonthSource === "manual" && s.assignedMonth != null
      ? s.assignedMonth
      : autoEnd.getMonth() + 1;
    const year = s.assignedMonthSource === "manual" && s.assignedYear != null
      ? s.assignedYear
      : autoEnd.getFullYear();
    setPeriodEditMonth(String(month));
    setPeriodEditYear(String(year));
    setEditingPeriodStatement(s);
  }

  async function handleSavePeriod(source: "manual" | "auto") {
    if (!editingPeriodStatement) return;
    setSavingPeriod(true);
    try {
      const body = source === "manual"
        ? { assignedMonth: Number(periodEditMonth), assignedYear: Number(periodEditYear), assignedMonthSource: "manual" }
        : { assignedMonth: null, assignedYear: null, assignedMonthSource: "auto" };
      const res = await fetch(`/api/personal/statements/${editingPeriodStatement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setEditingPeriodStatement(null);
      await loadStatements(editingPeriodStatement.id);
    } catch {
      // keep modal open
    } finally {
      setSavingPeriod(false);
    }
  }

  // ── Edit account ──────────────────────────────────────────
  function openEditAccount(acc: BankAccount) {
    setEditingAccount(acc);
    setAccountForm({ bankName: acc.bankName, productName: acc.productName, cardNumber: acc.cardNumber ?? "", type: acc.type });
    setSaveAccountError(null);
  }

  async function handleSaveAccount() {
    if (!editingAccount) return;
    setSavingAccount(true);
    setSaveAccountError(null);
    try {
      const res = await fetch(`/api/personal/accounts/${editingAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName: accountForm.bankName,
          productName: accountForm.productName,
          cardNumber: accountForm.cardNumber || null,
          type: accountForm.type,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setEditingAccount(null);
      await loadStatements();
    } catch (e: unknown) {
      setSaveAccountError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingAccount(false);
    }
  }

  // ── Edit transaction (desktop inline) ────────────────────
  function startEdit(t: BankTransaction) {
    setIsAddingRow(false);
    setEditingTxnId(t.id);
    setEditDraft(txnToDraft(t));
  }

  function cancelEdit() {
    setEditingTxnId(null);
    setEditDraft(EMPTY_DRAFT);
  }

  async function saveTxnEdit() {
    if (!editingTxnId) return;
    setSavingTxn(true);
    try {
      const res = await fetch(`/api/financial/transactions/${editingTxnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToPayload(editDraft)),
      });
      if (!res.ok) throw new Error();
      setEditingTxnId(null);
      fetchTransactions();
    } catch {
      // keep editing state so user can retry
    } finally {
      setSavingTxn(false);
    }
  }

  // ── Add new row (desktop) ────────────────────────────────
  function openAddRow() {
    setEditingTxnId(null);
    setNewDraft({
      ...EMPTY_DRAFT,
      transactionDate: selectedStatement?.periodEnd.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    });
    setIsAddingRow(true);
  }

  async function saveNewRow() {
    if (!selectedStatement) return;
    setSavingTxn(true);
    try {
      const res = await fetch("/api/financial/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statementId: selectedStatement.id,
          accountId: selectedStatement.accountId,
          ...draftToPayload(newDraft),
        }),
      });
      if (!res.ok) throw new Error();
      setIsAddingRow(false);
      setNewDraft(EMPTY_DRAFT);
      fetchTransactions();
    } catch {
      // keep add row open
    } finally {
      setSavingTxn(false);
    }
  }

  // ── Mobile modal ─────────────────────────────────────────
  function openMobileEdit(t: BankTransaction) {
    setMobileTxn(t);
    setMobileDraft(txnToDraft(t));
  }

  function openMobileAdd() {
    setMobileTxn("new");
    setMobileDraft({
      ...EMPTY_DRAFT,
      transactionDate: selectedStatement?.periodEnd.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    });
  }

  async function saveMobile() {
    if (!mobileTxn || !selectedStatement) return;
    setSavingTxn(true);
    try {
      let res: Response;
      if (mobileTxn === "new") {
        res = await fetch("/api/financial/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            statementId: selectedStatement.id,
            accountId: selectedStatement.accountId,
            ...draftToPayload(mobileDraft),
          }),
        });
      } else {
        res = await fetch(`/api/financial/transactions/${mobileTxn.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftToPayload(mobileDraft)),
        });
      }
      if (!res.ok) throw new Error();
      setMobileTxn(null);
      fetchTransactions();
    } catch {
      // keep modal open
    } finally {
      setSavingTxn(false);
    }
  }

  // Shared draft field updater
  function setDraft(
    setter: React.Dispatch<React.SetStateAction<TxnDraft>>,
    field: keyof TxnDraft,
    value: string
  ) {
    setter((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-6">
      <Header
        title="Estados de Cuenta"
        subtitle="Movimientos bancarios importados"
        actions={
          <>
            <button
              type="button"
              onClick={() => setOrganizeMode((v) => !v)}
              aria-pressed={organizeMode}
              aria-label="Organizar estados"
              className={organizeMode ? "btn-primary" : "btn-secondary"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Organizar estados
            </button>
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              aria-label="Importar estado de cuenta PDF o XML"
              className="btn-primary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Importar PDF / XML
            </button>
          </>
        }
      />

      {showImport && (
        <StatementImportCard
          onSuccess={() => { setShowImport(false); loadStatements(); }}
          onCancel={() => setShowImport(false)}
        />
      )}

      {organizeMode && (
        <div role="status" aria-live="polite" className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">
          Corrige estados importados en la cuenta equivocada.
        </div>
      )}

      {loadingStatements ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
        </div>
      ) : statementsError ? (
        <ApiErrorState message={statementsError} onRetry={loadStatements} />
      ) : statements.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 font-medium">Sin estados de cuenta</p>
          <p className="text-gray-400 text-sm mt-1">
            Usa el botón &quot;Importar PDF / XML&quot; para agregar tu primer estado de cuenta
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* ── Panel izquierdo: tarjetas y períodos ── */}
          <div className="lg:col-span-1 space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
              Tarjetas ({statementsByAccount.length})
            </p>

            {statementsByAccount.map(({ account, statements: groupStmts }) => (
              <div key={account.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <p className="text-xs font-semibold text-gray-700 truncate">{account.bankName}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {organizeMode && (
                      <button
                        type="button"
                        onClick={() => openMergeAccount(account)}
                        disabled={accountOptions.length < 2}
                        aria-label={`Fusionar ${accountLabel(account)}`}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-500 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500 transition-colors"
                      >
                        Fusionar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditAccount(account)}
                      aria-label={`Editar ${accountLabel(account)}`}
                      className="p-1 rounded text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-400 px-1 truncate">
                  {account.productName}{maskedCardSuffix(account.cardNumber)}
                </p>

                <div className="space-y-1 pl-1">
                  {groupStmts.map((s) => {
                    const isSelected = selectedStatement?.id === s.id;
                    return (
                      <div
                        key={s.id}
                        className={`group rounded-xl border transition-all ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 shadow-sm"
                            : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40"
                        }`}
                      >
                        <div className="flex items-start gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStatement(s);
                              setSearch("");
                              setTypeFilter("");
                              setEditingTxnId(null);
                              setIsAddingRow(false);
                            }}
                            aria-pressed={isSelected}
                            className="min-w-0 flex-1 text-left px-3 py-2.5 cursor-pointer"
                          >
                            <div className="flex items-center gap-1">
                              <p className={`text-xs font-semibold capitalize ${isSelected ? "text-indigo-700" : "text-gray-700"}`}>
                                {periodLabel(s)}
                              </p>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); openEditPeriod(s); }}
                                aria-label="Editar mes asignado"
                                title="Editar mes"
                                className={`p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 ${isSelected ? "text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100" : "text-gray-300 hover:text-gray-600 hover:bg-gray-100"}`}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                            <div className="mt-1 flex justify-between gap-2 text-xs">
                              <span className="text-red-500">↑ {formatCurrency(Number(s.totalCharges ?? 0))}</span>
                              <span className="text-green-600">↓ {formatCurrency(Number(s.totalCredits ?? 0))}</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingStatement(s)}
                            disabled={deletingStatementLoading && deletingStatement?.id === s.id}
                            aria-label={`Eliminar ${periodLabel(s)} de ${accountLabel(s.account)}`}
                            title="Eliminar estado"
                            className={`mt-2 mr-2 rounded-lg p-1.5 transition-all disabled:opacity-40 ${
                              isSelected
                                ? "text-gray-400 hover:bg-red-50 hover:text-red-600"
                                : "text-gray-300 hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                            }`}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        {organizeMode && (
                          <div className="px-3 pb-3">
                            <button
                              type="button"
                              onClick={() => openMoveStatement(s)}
                              disabled={accountOptions.length < 2}
                              aria-label={`Mover ${periodLabel(s)} de ${accountLabel(s.account)}`}
                              className="w-full rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                            >
                              Mover
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ── Panel derecho ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* KPIs */}
            {selectedStatement && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Período card — special: has edit button */}
                <div className="rounded-xl p-4 bg-indigo-50 text-indigo-700">
                  <p className="text-xs font-medium opacity-70">Período</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-lg font-bold leading-tight capitalize">{periodLabel(selectedStatement)}</p>
                    <button
                      type="button"
                      onClick={() => openEditPeriod(selectedStatement)}
                      aria-label="Editar mes asignado"
                      title="Editar mes asignado"
                      className="p-0.5 rounded text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 transition-colors flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs opacity-60 mt-0.5">{formatDate(selectedStatement.periodStart)} — {formatDate(selectedStatement.periodEnd)}</p>
                  {selectedStatement.assignedMonthSource === "manual" && (
                    <p className="text-[10px] opacity-50 mt-0.5 italic">editado manualmente</p>
                  )}
                </div>
                {[
                  { label: "Transacciones", value: transactions.length, sub: "en este período", color: "bg-gray-50 text-gray-700" },
                  { label: "Total cargos", value: formatCurrency(totalCharges), sub: "egresos del período", color: "bg-red-50 text-red-700" },
                  { label: "Total abonos", value: formatCurrency(totalCredits), sub: "ingresos del período", color: "bg-green-50 text-green-700" },
                ].map((kpi) => (
                  <div key={kpi.label} className={`rounded-xl p-4 ${kpi.color}`}>
                    <p className="text-xs font-medium opacity-70">{kpi.label}</p>
                    <p className="text-lg font-bold mt-1 leading-tight">{kpi.value}</p>
                    <p className="text-xs opacity-60 mt-0.5">{kpi.sub}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Barra de selección */}
            {activeSelection.length > 0 && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-indigo-800">
                  {activeSelection.length} movimiento{activeSelection.length !== 1 ? "s" : ""} seleccionado{activeSelection.length !== 1 ? "s" : ""}
                </span>
                {selectionCharges > 0 && (
                  <span className="text-sm font-medium text-red-600">Cargos: {formatCurrency(selectionCharges)}</span>
                )}
                {selectionCredits > 0 && (
                  <span className="text-sm font-medium text-green-600">Abonos: {formatCurrency(selectionCredits)}</span>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setSelectedTxnIds(new Set())}
                  className="btn-secondary text-xs py-1.5 px-3"
                  aria-label="Cancelar selección de movimientos"
                  disabled={sendingToPayments}
                >
                  Cancelar selección
                </button>
                <button
                  type="button"
                  onClick={handleSendToPayments}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  aria-label="Enviar movimientos seleccionados a Mis Pagos"
                  disabled={sendingToPayments}
                >
                  {sendingToPayments ? (
                    <>
                      <span className="animate-spin w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Enviar a Mis Pagos
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Filtros */}
            <div className="card p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  className="input"
                  placeholder="Buscar descripción..."
                  aria-label="Buscar por descripción de transacción"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className="input"
                  aria-label="Filtrar por tipo de movimiento"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as "" | "charge" | "credit")}
                >
                  <option value="">Todos los movimientos</option>
                  <option value="charge">Solo cargos</option>
                  <option value="credit">Solo abonos</option>
                </select>
                <select
                  className="input"
                  aria-label="Filtrar por estado de envío a Mis Pagos"
                  value={sentFilter}
                  onChange={(e) => setSentFilter(e.target.value as "" | "not_sent" | "sent")}
                >
                  <option value="">Todos (enviados y no enviados)</option>
                  <option value="not_sent">No enviados</option>
                  <option value="sent">Ya enviados</option>
                </select>
                <div className="flex items-center gap-1 text-xs text-gray-400 pl-1">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span>{selectedStatement ? accountLabel(selectedStatement.account) : "—"}</span>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 border-t border-gray-200 pt-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={unlinkedOnlyFilter}
                  onChange={(e) => setUnlinkedOnlyFilter(e.target.checked)}
                />
                <span>Mostrar solo transacciones no vinculadas a deudas</span>
              </label>
            </div>

            {/* Tabla */}
            <div className="card overflow-hidden">
              {/* Barra de acciones encima de la tabla */}
              {selectedStatement && (
                <div className="px-4 pt-3 pb-0 flex justify-end">
                  {/* Mobile: "Agregar" abre modal */}
                  <button
                    onClick={() => { openMobileAdd(); }}
                    className="sm:hidden btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar movimiento
                  </button>
                  {/* Desktop: toggle add row */}
                  {!isAddingRow ? (
                    <button
                      onClick={openAddRow}
                      className="hidden sm:flex btn-secondary text-xs py-1.5 px-3 items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Agregar movimiento
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsAddingRow(false)}
                      className="hidden sm:flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancelar
                    </button>
                  )}
                </div>
              )}

              {loadingTxns ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
                </div>
              ) : txnsError ? (
                <div className="p-6">
                  <ApiErrorState message={txnsError} onRetry={fetchTransactions} />
                </div>
              ) : sortedTransactions.length === 0 && !isAddingRow ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-sm">
                    Sin movimientos{search || typeFilter || sentFilter ? " con estos filtros" : ""}
                  </p>
                </div>
              ) : (
                <>
                  {/* ── Mobile list ── */}
                  <div className="sm:hidden divide-y divide-gray-100">
                    {/* Mobile sort controls */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/80 border-b border-gray-100">
                      <label htmlFor="mobile-sort-field" className="text-xs text-gray-500 font-medium whitespace-nowrap">
                        Ordenar por
                      </label>
                      <select
                        id="mobile-sort-field"
                        aria-label="Campo de ordenamiento"
                        className="input text-xs py-1 flex-1"
                        value={sortField}
                        onChange={(e) => setSortField(e.target.value as SortField)}
                      >
                        <option value="date">Fecha</option>
                        <option value="charge">Cargo</option>
                      </select>
                      <button
                        type="button"
                        aria-label={sortDirection === "desc" ? "Cambiar a orden ascendente" : "Cambiar a orden descendente"}
                        onClick={() => setSortDirection((d) => (d === "desc" ? "asc" : "desc"))}
                        className={`p-1.5 rounded-lg border transition-colors flex-shrink-0 ${sortDirection === "desc" ? "border-indigo-200 bg-indigo-50 text-indigo-600" : "border-gray-200 bg-white text-gray-500"}`}
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${sortDirection === "asc" ? "rotate-180" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    {sortedTransactions.map((t) => {
                      const alreadySent = !!t.personalPayment;
                      const isSelected = selectedTxnIds.has(t.id);
                      return (
                        <div key={t.id} className={`p-4 ${isSelected ? "bg-indigo-50/60" : ""}`}>
                          <div className="flex items-start gap-3">
                            {/* Checkbox mobile */}
                            <div className="flex-shrink-0 pt-0.5">
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar movimiento ${t.description}`}
                                checked={isSelected}
                                disabled={alreadySent}
                                onChange={(e) => {
                                  const next = new Set(selectedTxnIds);
                                  if (e.target.checked) next.add(t.id);
                                  else next.delete(t.id);
                                  setSelectedTxnIds(next);
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2 flex-wrap">
                                <p className="text-sm font-medium text-gray-900 leading-snug">{t.description}</p>
                                {alreadySent ? (
                                  <a
                                    href={`/personal/payments?search=${t.personalPayment!.folio}`}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors flex-shrink-0"
                                  >
                                    En Mis Pagos
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-400 flex-shrink-0">
                                    Pendiente
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">{formatDate(t.transactionDate)}</p>
                              {t.reference && (
                                <p className="text-xs text-indigo-500 mt-0.5 font-mono">{t.reference}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="text-right">
                                {t.chargeAmount != null && Number(t.chargeAmount) !== 0 && (
                                  <p className="text-sm font-semibold text-red-600">−{formatCurrency(t.chargeAmount)}</p>
                                )}
                                {t.creditAmount != null && Number(t.creditAmount) !== 0 && (
                                  <p className="text-sm font-semibold text-green-600">+{formatCurrency(t.creditAmount)}</p>
                                )}
                                {t.balance != null && (
                                  <p className="text-xs text-gray-400 mt-0.5">Saldo {formatCurrency(t.balance)}</p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                {!t.personalPayment && (
                                  <button
                                    onClick={() => setLinkingTransaction(t)}
                                    aria-label={`Vincular movimiento ${t.description} a deuda`}
                                    className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer"
                                    title="Vincular a deuda"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                  </button>
                                )}
                                <button
                                  onClick={() => openMobileEdit(t)}
                                  aria-label={`Editar movimiento ${t.description}`}
                                  className="p-1.5 rounded-lg text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="px-4 py-3 bg-gray-50 border-t flex justify-between items-center text-sm font-semibold">
                      <span className="text-gray-600">{sortedTransactions.length} movimientos</span>
                      <div className="flex gap-4">
                        <span className="text-red-600">−{formatCurrency(totalCharges)}</span>
                        <span className="text-green-600">+{formatCurrency(totalCredits)}</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Desktop table ── */}
                  <div className="hidden sm:block overflow-x-auto mt-3">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          <th className="pl-4 pr-2 py-3 w-10">
                            <input
                              type="checkbox"
                              aria-label="Seleccionar todos los movimientos visibles no enviados"
                              checked={allSelectableSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = someSelectableSelected && !allSelectableSelected;
                              }}
                              disabled={selectableTransactions.length === 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTxnIds(new Set(selectableTransactions.map((t) => t.id)));
                                } else {
                                  setSelectedTxnIds(new Set());
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                            />
                          </th>
                          <th className="px-4 py-3 w-28" aria-sort={sortField === "date" ? (sortDirection === "desc" ? "descending" : "ascending") : "none"}>
                            <SortButton field="date" label="FECHA" currentField={sortField} direction={sortDirection} onSort={handleSort} />
                          </th>
                          <th className="px-4 py-3">Descripción</th>
                          <th className="px-4 py-3 w-32">Referencia</th>
                          <th className="px-4 py-3 text-right w-28" aria-sort={sortField === "charge" ? (sortDirection === "desc" ? "descending" : "ascending") : "none"}>
                            <div className="flex justify-end">
                              <SortButton field="charge" label="CARGO" currentField={sortField} direction={sortDirection} onSort={handleSort} />
                            </div>
                          </th>
                          <th className="px-4 py-3 text-right w-28">Abono</th>
                          <th className="px-4 py-3 text-right w-28">Saldo</th>
                          <th className="px-4 py-3 w-16" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">

                        {/* ── New row ── */}
                        {isAddingRow && (
                          <tr className="bg-indigo-50/60">
                            <td className="pl-4 pr-2 py-2" />
                            <td className="px-2 py-2">
                              <input type="date" className={editInput} value={newDraft.transactionDate}
                                onChange={(e) => setDraft(setNewDraft, "transactionDate", e.target.value)} />
                            </td>
                            <td className="px-2 py-2">
                              <input className={editInput} placeholder="Descripción" value={newDraft.description}
                                onChange={(e) => setDraft(setNewDraft, "description", e.target.value)} />
                            </td>
                            <td className="px-2 py-2">
                              <input className={editInput} placeholder="Referencia" value={newDraft.reference}
                                onChange={(e) => setDraft(setNewDraft, "reference", e.target.value)} />
                            </td>
                            <td className="px-2 py-2">
                              <input type="number" min="0" step="0.01" className={editInput + " text-right"} placeholder="0.00"
                                value={newDraft.chargeAmount}
                                onChange={(e) => setDraft(setNewDraft, "chargeAmount", e.target.value)} />
                            </td>
                            <td className="px-2 py-2">
                              <input type="number" min="0" step="0.01" className={editInput + " text-right"} placeholder="0.00"
                                value={newDraft.creditAmount}
                                onChange={(e) => setDraft(setNewDraft, "creditAmount", e.target.value)} />
                            </td>
                            <td className="px-2 py-2">
                              <input type="number" step="0.01" className={editInput + " text-right"} placeholder="0.00"
                                value={newDraft.balance}
                                onChange={(e) => setDraft(setNewDraft, "balance", e.target.value)} />
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={saveNewRow} disabled={savingTxn || !newDraft.description}
                                  aria-label="Guardar nuevo movimiento"
                                  className="p-1 rounded text-green-600 hover:bg-green-100 disabled:opacity-40 cursor-pointer transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button onClick={() => setIsAddingRow(false)} aria-label="Cancelar nuevo movimiento"
                                  className="p-1 rounded text-gray-400 hover:bg-gray-100 cursor-pointer transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* ── Existing rows ── */}
                        {sortedTransactions.map((t) =>
                          editingTxnId === t.id ? (
                            /* ── Edit row ── */
                            <tr key={t.id} className="bg-indigo-50/60">
                              <td className="pl-4 pr-2 py-2" />
                              <td className="px-2 py-2">
                                <input type="date" className={editInput} value={editDraft.transactionDate}
                                  onChange={(e) => setDraft(setEditDraft, "transactionDate", e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <input className={editInput} value={editDraft.description}
                                  onChange={(e) => setDraft(setEditDraft, "description", e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <input className={editInput} value={editDraft.reference}
                                  onChange={(e) => setDraft(setEditDraft, "reference", e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" min="0" step="0.01" className={editInput + " text-right"}
                                  value={editDraft.chargeAmount}
                                  onChange={(e) => setDraft(setEditDraft, "chargeAmount", e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" min="0" step="0.01" className={editInput + " text-right"}
                                  value={editDraft.creditAmount}
                                  onChange={(e) => setDraft(setEditDraft, "creditAmount", e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <input type="number" step="0.01" className={editInput + " text-right"}
                                  value={editDraft.balance}
                                  onChange={(e) => setDraft(setEditDraft, "balance", e.target.value)} />
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex items-center gap-1 justify-end">
                                  <button onClick={saveTxnEdit} disabled={savingTxn || !editDraft.description}
                                    aria-label="Guardar cambios"
                                    className="p-1 rounded text-green-600 hover:bg-green-100 disabled:opacity-40 cursor-pointer transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button onClick={cancelEdit} aria-label="Cancelar edición"
                                    className="p-1 rounded text-gray-400 hover:bg-gray-100 cursor-pointer transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            /* ── Normal row ── */
                            <tr key={t.id} className={`group transition-colors ${selectedTxnIds.has(t.id) ? "bg-indigo-50/60" : "hover:bg-gray-50"}`}>
                              <td className="pl-4 pr-2 py-3">
                                <input
                                  type="checkbox"
                                  aria-label={`Seleccionar movimiento ${t.description}`}
                                  checked={selectedTxnIds.has(t.id)}
                                  disabled={!!t.personalPayment}
                                  onChange={(e) => {
                                    const next = new Set(selectedTxnIds);
                                    if (e.target.checked) next.add(t.id);
                                    else next.delete(t.id);
                                    setSelectedTxnIds(next);
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40 cursor-pointer disabled:cursor-default"
                                />
                              </td>
                              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(t.transactionDate)}</td>
                              <td className="px-4 py-3 text-gray-900 max-w-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <p className="truncate font-medium">{t.description}</p>
                                  {t.personalPayment ? (
                                    <a
                                      href={`/personal/payments?search=${t.personalPayment.folio}`}
                                      className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                                      title={`Folio: ${t.personalPayment.folio}`}
                                    >
                                      En Mis Pagos
                                    </a>
                                  ) : (
                                    <span className="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-400">
                                      Pendiente
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-indigo-500 whitespace-nowrap">
                                {t.reference ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-red-600">
                                {t.chargeAmount != null && Number(t.chargeAmount) !== 0
                                  ? formatCurrency(t.chargeAmount)
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-green-600">
                                {t.creditAmount != null && Number(t.creditAmount) !== 0
                                  ? formatCurrency(t.creditAmount)
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap text-gray-500">
                                {t.balance != null ? formatCurrency(t.balance) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                  {!t.personalPayment && (
                                    <button
                                      onClick={() => setLinkingTransaction(t)}
                                      aria-label={`Vincular ${t.description} a deuda`}
                                      className="p-1 rounded text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 cursor-pointer transition-colors"
                                      title="Vincular a deuda"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                      </svg>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => startEdit(t)}
                                    aria-label={`Editar ${t.description}`}
                                    className="p-1 rounded text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 cursor-pointer transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-600">
                            {sortedTransactions.length} movimiento{sortedTransactions.length !== 1 ? "s" : ""}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(totalCharges)}</td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(totalCredits)}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <MoveStatementModal
        statement={moveStatement}
        accounts={accountOptions}
        targetAccountId={moveTargetAccountId}
        mergeIfPeriodExists={mergeIfPeriodExists}
        loading={movingStatement}
        error={moveError}
        onTargetAccountChange={setMoveTargetAccountId}
        onMergeIfPeriodExistsChange={setMergeIfPeriodExists}
        onClose={() => {
          if (!movingStatement) setMoveStatement(null);
        }}
        onSubmit={handleMoveStatement}
      />

      <MergeAccountsModal
        sourceAccount={mergeSourceAccount}
        accounts={accountOptions}
        targetAccountId={mergeTargetAccountId}
        loading={mergingAccounts}
        error={mergeError}
        onTargetAccountChange={setMergeTargetAccountId}
        onClose={() => {
          if (!mergingAccounts) setMergeSourceAccount(null);
        }}
        onSubmit={handleMergeAccounts}
      />

      <ConfirmDialog
        open={!!deletingStatement}
        onClose={() => {
          if (!deletingStatementLoading) setDeletingStatement(null);
        }}
        onConfirm={handleDeleteStatement}
        title="Eliminar estado de cuenta"
        message={
          deletingStatement
            ? `¿Eliminar ${periodLabel(deletingStatement)} de ${accountLabel(deletingStatement.account)}? También se eliminarán sus movimientos bancarios importados.`
            : ""
        }
        confirmLabel="Eliminar estado"
        loading={deletingStatementLoading}
      />

      {/* ── Modal editar/agregar movimiento (mobile + add) ── */}
      <Modal
        open={mobileTxn !== null}
        onClose={() => setMobileTxn(null)}
        title={mobileTxn === "new" ? "Agregar movimiento" : "Editar movimiento"}
        size="sm"
      >
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Fecha</label>
            <input type="date" className="input w-full" value={mobileDraft.transactionDate}
              onChange={(e) => setDraft(setMobileDraft, "transactionDate", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Descripción</label>
            <input className="input w-full" placeholder="Descripción del movimiento" value={mobileDraft.description}
              onChange={(e) => setDraft(setMobileDraft, "description", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Referencia</label>
            <input className="input w-full" placeholder="Opcional" value={mobileDraft.reference}
              onChange={(e) => setDraft(setMobileDraft, "reference", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Cargo</label>
              <input type="number" min="0" step="0.01" className="input w-full" placeholder="0.00"
                value={mobileDraft.chargeAmount}
                onChange={(e) => setDraft(setMobileDraft, "chargeAmount", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Abono</label>
              <input type="number" min="0" step="0.01" className="input w-full" placeholder="0.00"
                value={mobileDraft.creditAmount}
                onChange={(e) => setDraft(setMobileDraft, "creditAmount", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Saldo</label>
            <input type="number" step="0.01" className="input w-full" placeholder="0.00"
              value={mobileDraft.balance}
              onChange={(e) => setDraft(setMobileDraft, "balance", e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setMobileTxn(null)} className="btn-secondary" disabled={savingTxn}>
              Cancelar
            </button>
            <button onClick={saveMobile} className="btn-primary"
              disabled={savingTxn || !mobileDraft.description || !mobileDraft.transactionDate}>
              {savingTxn
                ? <span className="flex items-center gap-2"><span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />Guardando…</span>
                : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Modal editar mes asignado ── */}
      <Modal
        open={!!editingPeriodStatement}
        onClose={() => { if (!savingPeriod) setEditingPeriodStatement(null); }}
        title="Mes asignado al estado"
        size="sm"
      >
        {editingPeriodStatement && (
          <div className="px-6 py-5 space-y-4">
            <p className="text-xs text-gray-500">
              El mes asignado se usa como título del estado de cuenta. Por defecto se calcula desde la fecha de corte (fecha final).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="period-edit-month" className="text-sm font-medium text-gray-700">Mes</label>
                <select
                  id="period-edit-month"
                  className="input w-full"
                  value={periodEditMonth}
                  onChange={(e) => setPeriodEditMonth(e.target.value)}
                  disabled={savingPeriod}
                >
                  {[
                    ["1","Enero"],["2","Febrero"],["3","Marzo"],["4","Abril"],
                    ["5","Mayo"],["6","Junio"],["7","Julio"],["8","Agosto"],
                    ["9","Septiembre"],["10","Octubre"],["11","Noviembre"],["12","Diciembre"],
                  ].map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="period-edit-year" className="text-sm font-medium text-gray-700">Año</label>
                <select
                  id="period-edit-year"
                  className="input w-full"
                  value={periodEditYear}
                  onChange={(e) => setPeriodEditYear(e.target.value)}
                  disabled={savingPeriod}
                >
                  {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
              Vista previa: <span className="font-semibold capitalize">
                {new Date(Number(periodEditYear), Number(periodEditMonth) - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
              </span>
            </div>
            <div className="pt-1 border-t border-gray-100">
              <button
                type="button"
                onClick={() => handleSavePeriod("auto")}
                disabled={savingPeriod}
                className="text-xs text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
              >
                Usar mes automático ({autoPeriodLabel(editingPeriodStatement.periodEnd)})
              </button>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setEditingPeriodStatement(null)}
                className="btn-secondary"
                disabled={savingPeriod}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSavePeriod("manual")}
                className="btn-primary"
                disabled={savingPeriod}
              >
                {savingPeriod
                  ? <span className="flex items-center gap-2"><span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />Guardando…</span>
                  : "Guardar"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal editar procedencia ── */}
      <Modal
        open={!!editingAccount}
        onClose={() => setEditingAccount(null)}
        title="Editar procedencia"
        size="md"
      >
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1">
            <label htmlFor="edit-bankName" className="text-sm font-medium text-gray-700">Banco</label>
            <input id="edit-bankName" className="input w-full" placeholder="Ej. Santander"
              value={accountForm.bankName}
              onChange={(e) => setAccountForm((f) => ({ ...f, bankName: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-productName" className="text-sm font-medium text-gray-700">Nombre del producto</label>
            <input id="edit-productName" className="input w-full" placeholder="Ej. Tarjeta de Crédito"
              value={accountForm.productName}
              onChange={(e) => setAccountForm((f) => ({ ...f, productName: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-cardNumber" className="text-sm font-medium text-gray-700">Últimos 4 dígitos</label>
            <input id="edit-cardNumber" className="input w-full" placeholder="Ej. 3937" maxLength={4}
              value={accountForm.cardNumber}
              onChange={(e) => setAccountForm((f) => ({ ...f, cardNumber: e.target.value.replace(/\D/g, "") }))} />
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-type" className="text-sm font-medium text-gray-700">Tipo de cuenta</label>
            <select id="edit-type" className="input w-full" value={accountForm.type}
              onChange={(e) => setAccountForm((f) => ({ ...f, type: e.target.value as "CHECKING" | "CREDIT" }))}>
              <option value="CREDIT">Tarjeta de crédito</option>
              <option value="CHECKING">Cuenta de débito / cheques</option>
            </select>
          </div>
          {saveAccountError && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{saveAccountError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditingAccount(null)} className="btn-secondary" disabled={savingAccount}>
              Cancelar
            </button>
            <button onClick={handleSaveAccount} className="btn-primary"
              disabled={savingAccount || !accountForm.bankName || !accountForm.productName}>
              {savingAccount
                ? <span className="flex items-center gap-2"><span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />Guardando…</span>
                : "Guardar cambios"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Link transaction to debt modal ── */}
      <LinkTransactionModal
        open={!!linkingTransaction}
        onClose={() => setLinkingTransaction(null)}
        onSuccess={() => {
          setLinkingTransaction(null);
          fetchTransactions();
        }}
        transaction={linkingTransaction}
        debtAccounts={debts}
      />
    </div>
  );
}
