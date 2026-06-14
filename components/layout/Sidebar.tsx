"use client";

import {
  BadgePercent,
  BarChart3,
  CalendarDays,
  CreditCard,
  Gauge,
  Menu,
  Package,
  Scissors,
  Users,
  WalletCards,
  Settings,
  X,
  Boxes,
  History,
  Coins,
  LogOut,
} from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { useMemo } from "react";
import { useAppData } from "@/context/AppDataContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

const menuGroups = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: Gauge },
    ],
  },
  {
    title: "Daily Operations",
    items: [
      { label: "Billing", href: "/billing", icon: CreditCard },
      { label: "Invoices", href: "/invoices", icon: History },
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Appointments", href: "/appointments", icon: CalendarDays },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Services", href: "/services", icon: Scissors },
      { label: "Products", href: "/products", icon: Package },
      { label: "Offers", href: "/offers", icon: WalletCards },
    ],
  },
  {
    title: "Team",
    items: [
      { label: "Staff", href: "/staff", icon: BadgePercent },
    ],
  },
  {
    title: "Business",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3 },
      { label: "Expenses", href: "/expenses", icon: Coins },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  setMobileOpen,
}: SidebarProps) {
  const { settings, products } = useAppData();
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const salonName = useMemo(() => {
    if (!settings?.salonName) return "Explore";
    return settings.salonName.split(" ")[0];
  }, [settings]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.quantity <= 5).length;
  }, [products]);

  const navList = (isMobile: boolean) => (
    <div className="space-y-6">
      {menuGroups.map((group, groupIdx) => {
        const showHeader = group.title && (!collapsed || isMobile);
        const showSeparator = groupIdx > 0 && collapsed && !isMobile;

        return (
          <div key={group.title || groupIdx} className="space-y-2">
            {showSeparator && (
              <div className="my-4 border-t border-white/5 mx-2" />
            )}
            {showHeader && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-500">
                {group.title}
              </p>
            )}
            <nav className="space-y-1">
              {group.items.map((item) => (
                <SidebarItem
                  key={item.label}
                  label={item.label}
                  href={item.href}
                  icon={item.icon}
                  collapsed={isMobile ? false : collapsed}
                  onClick={isMobile ? () => setMobileOpen(false) : undefined}
                />
              ))}
            </nav>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Desktop/Tablet Collapsible Sidebar */}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-30 hidden border-r border-stone-850 bg-black shadow-2xl transition-all duration-300 lg:block ${collapsed ? "w-24" : "w-72"
          }`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-8 flex h-14 items-center justify-between">
            <div className="flex min-w-0 items-center">
              {!collapsed && (
                <div>
                  <p className="text-lg font-bold tracking-wide text-white">{salonName}</p>
                  <p className="text-xs uppercase tracking-[0.28em] text-stone-400">Salon ERP</p>
                </div>
              )}
            </div>
            <button
              aria-label="Toggle sidebar"
              onClick={onToggle}
              className={`grid size-10 place-items-center rounded-2xl border border-white/10 text-stone-300 transition hover:border-white hover:bg-white/10 hover:text-white ${collapsed ? "mx-auto" : ""
                }`}
            >
              <Menu size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 select-none font-medium flex flex-col justify-between">
            <div>
              {navList(false)}
            </div>

            <div className="mt-6 mb-4 shrink-0">
              <button
                onClick={handleLogout}
                className={`group flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition duration-200 text-stone-400 hover:bg-red-950/30 hover:text-red-400 ${
                  collapsed ? "justify-center" : "justify-start"
                }`}
              >
                <LogOut size={20} className="transition group-hover:text-red-400" />
                {!collapsed && <span className="truncate">Logout</span>}
              </button>
            </div>
          </div>

          {!collapsed && (
            <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-white">
                <Boxes size={18} />
                <span className="text-sm font-semibold">Inventory Alert</span>
              </div>
              <p className="text-sm leading-6 text-stone-300">
                {lowStockCount > 0
                  ? `${lowStockCount} products are close to reorder level.`
                  : "All products are sufficiently stocked."}
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer Navigation overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer Panel */}
          <aside className="fixed bottom-0 left-0 top-0 z-50 w-72 border-r border-stone-850 bg-black p-4 flex flex-col shadow-2xl transition-transform duration-300">
            <div className="mb-8 flex h-14 items-center justify-between">
              <div className="flex min-w-0 items-center">
                <div>
                  <p className="text-lg font-bold tracking-wide text-white">{salonName}</p>
                  <p className="text-xs uppercase tracking-[0.28em] text-stone-400">Salon ERP</p>
                </div>
              </div>
              <button
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="grid size-10 place-items-center rounded-2xl border border-white/10 text-stone-300 transition hover:border-white hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 select-none font-medium flex flex-col justify-between">
              <div>
                {navList(true)}
              </div>

              <div className="mt-6 mb-4 shrink-0">
                <button
                  onClick={async () => {
                    setMobileOpen(false);
                    await handleLogout();
                  }}
                  className="group flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition duration-200 text-stone-400 hover:bg-red-950/30 hover:text-red-400 justify-start"
                >
                  <LogOut size={20} className="transition group-hover:text-red-400" />
                  <span className="truncate">Logout</span>
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-white">
                <Boxes size={18} />
                <span className="text-sm font-semibold">Inventory Alert</span>
              </div>
              <p className="text-sm leading-6 text-stone-300">
                {lowStockCount > 0
                  ? `${lowStockCount} products are close to reorder level.`
                  : "All products are sufficiently stocked."}
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
