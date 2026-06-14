"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { formatCurrency, formatDate, STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/utils";
import StatusBadge from "@/components/ui/StatusBadge";
import { resolveReceiptUrl } from "@/lib/receipt";

export interface PaymentRow {
  id: string;
  folio: string;
  name: string;
  concept: string;
  amount: string | number;
  paymentDate: string | null;
  dueDate: string | null;
  status: string;
  paymentMethod: string;
  period: string;
  category: { name: string; color: string };
  paidBy: { name: string | null } | null;
  registeredAt: string;
  receipt: string | null;
}

interface PaymentTableProps {
  data: PaymentRow[];
  onEdit: (row: PaymentRow) => void;
  onDelete: (row: PaymentRow) => void;
  onViewReceipt: (url: string) => void;
}

export default function PaymentTable({ data, onEdit, onDelete, onViewReceipt }: PaymentTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<PaymentRow>[] = [
    {
      accessorKey: "folio",
      header: "Folio",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-indigo-700 font-semibold">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Nombre",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{row.original.name}</p>
          <p className="text-xs text-gray-400">{row.original.concept}</p>
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: "Categoría",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: row.original.category?.color }}
          />
          <span className="text-sm">{row.original.category?.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: "Monto",
      cell: ({ getValue }) => (
        <span className="font-semibold text-gray-900">{formatCurrency(getValue() as number)}</span>
      ),
    },
    {
      accessorKey: "dueDate",
      header: "Fecha límite",
      cell: ({ getValue }) => (
        <span className="text-sm text-gray-600">{formatDate(getValue() as string)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      accessorKey: "paymentMethod",
      header: "Forma de pago",
      cell: ({ getValue }) => (
        <span className="text-sm text-gray-600">
          {PAYMENT_METHOD_LABELS[getValue() as string] ?? getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "paidBy",
      header: "Pagado por",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">{row.original.paidBy?.name ?? "—"}</span>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.receipt && (
            <button
              onClick={() => {
                const url = resolveReceiptUrl(row.original.receipt);
                if (url) onViewReceipt(url);
              }}
              aria-label={`Ver comprobante del pago ${row.original.name}`}
              className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onEdit(row.original)}
            aria-label={`Editar pago ${row.original.name}`}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(row.original)}
            aria-label={`Eliminar pago ${row.original.name}`}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="card overflow-hidden">
      {/* ── Mobile card list ── */}
      <div className="sm:hidden divide-y divide-gray-100">
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-gray-400 text-sm">No hay registros para mostrar</p>
        ) : (
          rows.map((row) => {
            const p = row.original;
            const receiptUrl = resolveReceiptUrl(p.receipt);
            return (
              <div key={row.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{p.concept}</p>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm flex-shrink-0">
                    {formatCurrency(p.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.category?.color }} />
                    <span className="text-xs text-gray-500">{p.category?.name}</span>
                  </div>
                  <StatusBadge status={p.status} />
                  {p.dueDate && (
                    <span className="text-xs text-gray-400">Vence: {formatDate(p.dueDate)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-indigo-600">{p.folio}</span>
                  <div className="flex items-center gap-1">
                    {receiptUrl && (
                      <button
                        onClick={() => onViewReceipt(receiptUrl)}
                        aria-label={`Ver comprobante del pago ${p.name}`}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => onEdit(p)}
                      aria-label={`Editar pago ${p.name}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(p)}
                      aria-label={`Eliminar pago ${p.name}`}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700"
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && <span>↑</span>}
                      {header.column.getIsSorted() === "desc" && <span>↓</span>}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400">
                  No hay registros para mostrar
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
        <p className="text-sm text-gray-500">
          {data.length} registro{data.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="btn-secondary py-1 px-2 text-xs disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-500">
            Pág. {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="btn-secondary py-1 px-2 text-xs disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  );
}
