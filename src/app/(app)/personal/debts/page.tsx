"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Header from "@/components/layout/Header";
import DebtSummaryCards from "@/components/personal/debts/DebtSummaryCards";
import DebtListTable from "@/components/personal/debts/DebtListTable";
import DebtMobileCard from "@/components/personal/debts/DebtMobileCard";
import DebtFormSheet from "@/components/personal/debts/DebtFormSheet";
import SearchInput from "@/components/ui/SearchInput";
import { cn } from "@/lib/utils";

interface DebtAccount {
  id: string;
  name: string;
  counterpartyName: string | null;
  type: string;
  direction: "PAYABLE" | "RECEIVABLE";
  originalPrincipal: number;
  currentPrincipal: number;
  status: string;
  nextDueDate: string | null;
  startDate: string;
  personalCardId: string | null;
  scheduleMode: "FREE" | "INSTALLMENTS";
}

interface DebtSummary {
  totalPayable: number;
  totalReceivable: number;
  estimatedMonthlyPayment: number;
  nextDueDate: string | null;
  overdueInstallments: number;
  principalPaidCurrentYear: number;
}

export default function DebtsPage() {
  const router = useRouter();
  const [debts, setDebts] = useState<DebtAccount[]>([]);
  const [summary, setSummary] = useState<DebtSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState<"payable" | "receivable" | "paid-off">("payable");
  const [formSheetOpen, setFormSheetOpen] = useState(false);

  // Filtro de tipo
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  // Filtro de estado
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [debtsRes, summaryRes] = await Promise.all([
        fetch("/api/personal/debts"),
        fetch("/api/personal/debts/summary"),
      ]);

      if (!debtsRes.ok) {
        throw new Error("No se pudieron cargar las deudas");
      }

      const debtsData = await debtsRes.json();
      setDebts(debtsData);

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
      toast.error("Error al cargar las deudas");
    } finally {
      setLoading(false);
    }
  };

  const handleDebtCreated = () => {
    setFormSheetOpen(false);
    fetchData();
  };

  // Filtrar deudas según criterios
  const filteredDebts = debts.filter((debt) => {
    // Filtro por búsqueda
    const matchesSearch =
      debt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (debt.counterpartyName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    // Filtro por tipo
    const matchesType = typeFilter.length === 0 || typeFilter.includes(debt.type);

    // Filtro por estado
    const matchesStatus = !statusFilter || debt.status === statusFilter;

    // Filtro por tab
    let matchesTab = true;
    if (selectedTab === "payable") {
      matchesTab = debt.direction === "PAYABLE" && debt.status !== "PAID_OFF";
    } else if (selectedTab === "receivable") {
      matchesTab = debt.direction === "RECEIVABLE" && debt.status !== "PAID_OFF";
    } else if (selectedTab === "paid-off") {
      matchesTab = debt.status === "PAID_OFF";
    }

    return matchesSearch && matchesType && matchesStatus && matchesTab;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header
        title="Deudas y préstamos"
        subtitle="Controla lo que debes, lo que te deben y cada pago realizado."
        actions={
          <button
            onClick={() => setFormSheetOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap"
          >
            + Nueva deuda o préstamo
          </button>
        }
      />

      {/* Summary Cards */}
      {summary && <DebtSummaryCards summary={summary} onTabSelect={setSelectedTab} />}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setSelectedTab("payable")}
          className={cn(
            "px-4 py-2 font-medium border-b-2 transition-colors",
            selectedTab === "payable"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          )}
        >
          Por pagar
          {debts.filter((d) => d.direction === "PAYABLE" && d.status !== "PAID_OFF").length > 0 && (
            <span className="ml-2 bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-xs">
              {debts.filter((d) => d.direction === "PAYABLE" && d.status !== "PAID_OFF").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSelectedTab("receivable")}
          className={cn(
            "px-4 py-2 font-medium border-b-2 transition-colors",
            selectedTab === "receivable"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          )}
        >
          Por cobrar
          {debts.filter((d) => d.direction === "RECEIVABLE" && d.status !== "PAID_OFF").length > 0 && (
            <span className="ml-2 bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-xs">
              {debts.filter((d) => d.direction === "RECEIVABLE" && d.status !== "PAID_OFF").length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSelectedTab("paid-off")}
          className={cn(
            "px-4 py-2 font-medium border-b-2 transition-colors",
            selectedTab === "paid-off"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
          )}
        >
          Liquidadas
          {debts.filter((d) => d.status === "PAID_OFF").length > 0 && (
            <span className="ml-2 bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-xs">
              {debts.filter((d) => d.status === "PAID_OFF").length}
            </span>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <SearchInput
            placeholder="Buscar por nombre o contraparte..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activo</option>
            <option value="PAUSED">Pausado</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>

        {(searchTerm || statusFilter || typeFilter.length > 0) && (
          <button
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("");
              setTypeFilter([]);
            }}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Empty State */}
      {filteredDebts.length === 0 && !error ? (
        <div className="card p-12 text-center">
          {debts.length === 0 ? (
            <div className="space-y-3">
              <div className="text-4xl">💰</div>
              <h3 className="font-semibold text-lg text-gray-900">Sin deudas ni préstamos registrados</h3>
              <p className="text-gray-500 max-w-sm mx-auto">
                Registra una obligación para controlar su saldo, pagos y próximas fechas.
              </p>
              <button
                onClick={() => setFormSheetOpen(true)}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Registrar primera deuda
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">No hay resultados con los filtros actuales</h3>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("");
                  setTypeFilter([]);
                }}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      ) : error ? (
        <div className="card p-6 text-center text-red-600">
          <p>Error al cargar las deudas: {error}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <DebtListTable debts={filteredDebts} />
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredDebts.map((debt) => (
              <DebtMobileCard
                key={debt.id}
                debt={debt}
                onClick={() => router.push(`/personal/debts/${debt.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Debt Form Sheet */}
      <DebtFormSheet
        open={formSheetOpen}
        onClose={() => setFormSheetOpen(false)}
        onSuccess={handleDebtCreated}
      />
    </div>
  );
}
