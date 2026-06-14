"use client";

import { Sparkles, Menu } from "lucide-react";
import { useAppData } from "@/context/AppDataContext";

interface NavbarProps {
  onToggleMobileSidebar: () => void;
}

export function Navbar({ onToggleMobileSidebar }: NavbarProps) {
  const { settings } = useAppData();
  const salonName = settings?.salonName || "Explore Salon";

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white px-4 py-4 sm:px-6 lg:px-8 shadow-sm">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Left Section: Mobile Menu Toggle & Brand Logo */}
        <div className="flex items-center gap-3 lg:hidden">
          <button
            onClick={onToggleMobileSidebar}
            className="grid size-11 place-items-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-700 transition hover:bg-stone-100 hover:text-black"
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-black text-white">
              <Sparkles size={16} />
            </div>
            <span className="hidden font-semibold text-stone-900 text-sm sm:block">Explore</span>
          </div>
        </div>
        <div className="hidden lg:block" />

        {/* Center Section: Branding Text */}
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          <div className="hidden h-px w-6 bg-gradient-to-r from-transparent to-stone-300 sm:block sm:w-10" />
          <div className="text-center min-w-0">
            <p className="text-xs font-semibold tracking-wide text-stone-900 sm:text-base lg:text-lg truncate">{salonName}</p>
            <p className="text-[8px] uppercase tracking-[0.3em] text-stone-500 sm:text-[10px] sm:tracking-[0.4em]">Management Suite</p>
          </div>
          <div className="hidden h-px w-6 bg-gradient-to-l from-transparent to-stone-300 sm:block sm:w-10" />
        </div>

        {/* Right Section: Removed Notification, Settings, and Profile to keep layout balanced */}
        <div className="flex justify-end gap-2" />
      </div>
    </header>
  );
}
