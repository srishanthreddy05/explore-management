"use client";

import { Menu } from "lucide-react";
import DashboardNotifications from "@/components/salon-dashboard/dashboard-notifications";

interface NavbarProps {
  onToggleMobileSidebar: () => void;
}

export function Navbar({ onToggleMobileSidebar }: NavbarProps) {
  return (
    <header
      className="sticky top-0 z-20 border-b shadow-md overflow-hidden"
      style={{ backgroundColor: "#000000", borderColor: "#1a1a1a", height: "80px" }}
    >
      {/* Banner image — centered, contained */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src="/epx.jpeg"
          alt="Explore Salon"
          className="h-12 w-auto object-contain"
          style={{ maxWidth: "320px" }}
        />
      </div>

      {/* Overlay grid on top of banner */}
      <div className="relative h-full grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left: Mobile menu toggle */}
        <div className="flex items-center gap-3 lg:hidden">
          <button
            onClick={onToggleMobileSidebar}
            className="grid size-11 place-items-center rounded-2xl border border-white/30 text-white transition hover:bg-white/20"
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>
        </div>
        <div className="hidden lg:block" />

        {/* Center: empty — banner is the branding */}
        <div />

        {/* Right: Notification Bell */}
        <div className="flex justify-end gap-2">
          <DashboardNotifications />
        </div>
      </div>
    </header>
  );
}
