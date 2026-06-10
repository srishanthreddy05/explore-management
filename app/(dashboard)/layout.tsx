"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-stone-900 font-sans antialiased">
      
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      
      <div
        className={`min-h-screen flex flex-col transition-all duration-300 ${
          collapsed ? "lg:pl-24" : "lg:pl-72"
        }`}
      >
        <Navbar onToggleMobileSidebar={() => setMobileOpen((value) => !value)} />
        <main className="flex-1 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
