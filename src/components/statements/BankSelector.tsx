"use client";

import { useState } from "react";

export type BankType = "AUTO_DETECT" | "SANTANDER" | "BBVA" | "SCOTIABANK" | "BCI" | "OTHER";

interface BankSelectorProps {
  onSelect: (bank: BankType) => void;
  selectedBank?: BankType;
  disabled?: boolean;
}

const BANKS = [
  {
    id: "AUTO_DETECT",
    name: "Detección Automática",
    description: "Identificamos el banco automáticamente",
    icon: "🔍",
  },
  {
    id: "SANTANDER",
    name: "Santander",
    description: "Santander Consumer Bank",
    icon: "🏦",
  },
  {
    id: "BBVA",
    name: "BBVA",
    description: "BBVA Chile",
    icon: "🏦",
  },
  {
    id: "SCOTIABANK",
    name: "Scotiabank",
    description: "Scotiabank Chile",
    icon: "🏦",
  },
  {
    id: "BCI",
    name: "BCI",
    description: "Banco de Crédito e Inversiones",
    icon: "🏦",
  },
  {
    id: "OTHER",
    name: "Otro Banco",
    description: "Cualquier otra institución financiera",
    icon: "🏦",
  },
];

export default function BankSelector({
  onSelect,
  selectedBank,
  disabled = false,
}: BankSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Qué banco es el estado de cuenta?</h3>
        <p className="text-sm text-gray-600">Selecciona tu banco o usa la detección automática</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {BANKS.map((bank) => (
          <button
            key={bank.id}
            onClick={() => onSelect(bank.id as BankType)}
            disabled={disabled}
            className={`relative p-4 rounded-lg border-2 transition-all duration-200 text-left ${
              selectedBank === bank.id
                ? "border-indigo-600 bg-indigo-50 shadow-md"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-1">{bank.icon}</span>
              <div>
                <p className="font-medium text-gray-900">{bank.name}</p>
                <p className="text-sm text-gray-600 mt-1">{bank.description}</p>
              </div>
              {selectedBank === bank.id && (
                <div className="absolute top-3 right-3">
                  <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
