"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

const groupItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/payments",
    label: "Pagos",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    href: "/pantry",
    label: "Despensa",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
  {
    href: "/categories",
    label: "Categorías",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
];

const adminItems = [
  {
    href: "/users",
    label: "Usuarios",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
];

const personalItems = [
  {
    href: "/personal/dashboard",
    label: "Mi Dashboard",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6a9 9 0 00-9 9M12 6a9 9 0 019 9" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15l3-5" />
        <circle cx="12" cy="15" r="1.5" strokeWidth={2} />
      </svg>
    ),
  },
  {
    href: "/personal/payments",
    label: "Mis Pagos",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    href: "/personal/categories",
    label: "Mis Categorías",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    href: "/personal/cards",
    label: "Mis Tarjetas",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    href: "/personal/statements",
    label: "Estados de Cuenta",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/financial/recovery-plan",
    label: "Plan de Recuperación",
    icon: (
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [groupOpen, setGroupOpen] = useState(true);
  const [personalGroupOpen, setPersonalGroupOpen] = useState(true);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const navLinkClass = (href: string) =>
    cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
      collapsed && "justify-center px-0",
      isActive(href)
        ? "bg-indigo-700 text-white"
        : "text-indigo-200 hover:bg-indigo-800 hover:text-white"
    );

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 bg-indigo-900 text-white flex flex-col transition-all duration-200",
        collapsed ? "w-16" : "w-64",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Logo + toggle */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-indigo-800 min-h-[72px] relative">
        <div className="w-8 h-8 bg-indigo-400 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
        </div>

        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-tight">Finanzas del</p>
            <p className="font-bold text-sm leading-tight text-indigo-300">Hogar</p>
          </div>
        )}

        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="md:hidden flex items-center justify-center w-7 h-7 rounded-md text-indigo-300 hover:bg-indigo-700 hover:text-white transition-colors flex-shrink-0"
          title="Cerrar menú"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={onToggle}
          className={cn(
            "hidden md:flex items-center justify-center w-7 h-7 rounded-md text-indigo-300 hover:bg-indigo-700 hover:text-white transition-colors flex-shrink-0",
            collapsed && "mx-auto"
          )}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
        >
          <svg
            className={cn("w-4 h-4 transition-transform duration-200", collapsed && "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto space-y-1 px-2">

        {/* Group header: Finanzas en Pareja */}
        {!collapsed && (
          <button
            onClick={() => setGroupOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-indigo-400 uppercase tracking-wider hover:text-indigo-200 hover:bg-indigo-800/40 transition-colors"
          >
            {/* Heart icon */}
            <svg className="w-4 h-4 flex-shrink-0 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span className="flex-1 text-left">Finanzas en Pareja</span>
            <svg
              className={cn("w-3 h-3 transition-transform duration-200", !groupOpen && "-rotate-90")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Group items */}
        {(collapsed || groupOpen) &&
          groupItems.map((item) => (
            <Link key={item.href} href={item.href} className={navLinkClass(item.href)} title={collapsed ? item.label : undefined} onClick={onMobileClose}>
              {item.icon}
              {!collapsed && item.label}
            </Link>
          ))}

        {/* Separator */}
        <div className={cn("my-1", !collapsed && "border-t border-indigo-800/60 mx-1")} />

        {/* Group header: Mis Finanzas */}
        {!collapsed && (
          <button
            onClick={() => setPersonalGroupOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-indigo-400 uppercase tracking-wider hover:text-indigo-200 hover:bg-indigo-800/40 transition-colors"
          >
            <svg className="w-4 h-4 flex-shrink-0 text-sky-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm-7 9a7 7 0 1114 0H5z" />
            </svg>
            <span className="flex-1 text-left">Mis Finanzas</span>
            <svg
              className={cn("w-3 h-3 transition-transform duration-200", !personalGroupOpen && "-rotate-90")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* Personal items */}
        {(collapsed || personalGroupOpen) &&
          personalItems.map((item) => (
            <Link key={item.href} href={item.href} className={navLinkClass(item.href)} title={collapsed ? item.label : undefined} onClick={onMobileClose}>
              {item.icon}
              {!collapsed && item.label}
            </Link>
          ))}

        {/* Separator */}
        <div className={cn("my-1", !collapsed && "border-t border-indigo-800/60 mx-1")} />

        {/* Admin items */}
        {isAdmin && (
          <>
            {!collapsed && (
              <div className="px-3 pt-4 pb-1">
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">
                  Administración
                </p>
              </div>
            )}
            {adminItems.map((item) => (
              <Link key={item.href} href={item.href} className={navLinkClass(item.href)} title={collapsed ? item.label : undefined} onClick={onMobileClose}>
                {item.icon}
                {!collapsed && item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User info + logout */}
      <div className="px-2 py-4 border-t border-indigo-800">
        {!collapsed && (
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
              {session?.user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session?.user?.name ?? "Usuario"}</p>
              <p className="text-xs text-indigo-300 truncate">{session?.user?.role}</p>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="flex justify-center mb-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-sm font-bold">
              {session?.user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
          </div>
        )}

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-indigo-200 hover:bg-indigo-800 hover:text-white transition-colors",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? "Cerrar sesión" : undefined}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && "Cerrar sesión"}
        </button>
      </div>
    </aside>
  );
}
