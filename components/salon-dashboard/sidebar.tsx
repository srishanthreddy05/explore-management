"use client";

import {
  BadgePercent,
  BarChart3,
  Boxes,
  CalendarDays,
  CreditCard,
  Gauge,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Scissors,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";

const menuItems = [
  { label: "Dashboard", icon: Gauge },
  { label: "Appointments", icon: CalendarDays },
  { label: "Customers", icon: Users },
  { label: "Services", icon: Scissors },
  { label: "Products", icon: Package },
  { label: "Billing", icon: CreditCard, active: true },
  { label: "Staff", icon: BadgePercent },
  { label: "Reports", icon: BarChart3 },
  { label: "Offers", icon: WalletCards },
  { label: "Expenses", icon: ReceiptText },
  { label: "Logout", icon: LogOut },
];

export function Sidebar({
  collapsed,
  onToggleAction,
}: {
  collapsed: boolean;
  onToggleAction: () => void;
}) {
  return (
    <aside
      className={`fixed bottom-0 left-0 top-0 z-30 hidden border-r border-white/10 bg-black/75 shadow-2xl shadow-black/50 backdrop-blur-xl transition-all duration-300 lg:block ${
        collapsed ? "w-24" : "w-72"
      }`}
    >
      <div className="flex h-full flex-col p-4">
        <div className="mb-8 flex h-14 items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/15 text-[#D4AF37] shadow-lg shadow-[#D4AF37]/10">
              <Sparkles size={24} />
            </div>
            {!collapsed && (
              <div>
                <p className="text-lg font-semibold tracking-wide text-white">Explore</p>
                <p className="text-xs uppercase tracking-[0.28em] text-[#D4AF37]">Salon ERP</p>
              </div>
            )}
          </div>
          <button
            aria-label="Toggle sidebar"
            onClick={onToggleAction}
            className="grid size-10 place-items-center rounded-2xl border border-white/10 text-stone-300 transition hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]"
          >
            <Menu size={18} />
          </button>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`group flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-medium transition duration-200 ${
                  item.active
                    ? "bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/25"
                    : "text-stone-400 hover:bg-white/8 hover:text-white"
                } ${collapsed ? "justify-center" : "justify-start"}`}
              >
                <Icon
                  size={20}
                  className={item.active ? "text-black" : "transition group-hover:text-[#D4AF37]"}
                />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="mt-auto rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/10 p-4">
            <div className="mb-3 flex items-center gap-2 text-[#D4AF37]">
              <Boxes size={18} />
              <span className="text-sm font-semibold">Inventory Alert</span>
            </div>
            <p className="text-sm leading-6 text-stone-300">
              8 premium retail products are close to reorder level.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
