"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon } from "lucide-react";

interface SidebarItemProps {
  label: string;
  href: string;
  icon: LucideIcon;
  collapsed: boolean;
  onClick?: () => void;
}

export function SidebarItem({
  label,
  href,
  icon: Icon,
  collapsed,
  onClick,
}: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group flex h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition duration-200 ${
        isActive
          ? "bg-white text-black shadow-md shadow-black/10"
          : "text-stone-400 hover:bg-white/10 hover:text-white"
      } ${collapsed ? "justify-center" : "justify-start"}`}
    >
      <Icon
        size={20}
        className={isActive ? "text-black" : "transition group-hover:text-white"}
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
