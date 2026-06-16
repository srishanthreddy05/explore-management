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
      className={`group flex h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold transition duration-200 ${
        isActive
          ? "border-l-2 border-[#B8962E] bg-[#1C1A16] text-[#F5F0E8]"
          : "text-[#6B6358] hover:bg-[#1C1A16] hover:text-[#F5F0E8]"
      } ${collapsed ? "justify-center" : "justify-start"}`}
    >
      <Icon
        size={20}
        className={isActive ? "text-[#B8962E]" : "transition text-[#6B6358] group-hover:text-[#F5F0E8]"}
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
