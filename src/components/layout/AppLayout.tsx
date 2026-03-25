"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <main
        className="transition-all duration-200"
        style={{ paddingLeft: collapsed ? "4rem" : "16rem" }}
      >
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
