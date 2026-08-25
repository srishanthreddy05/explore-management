"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { ServiceBreakdownItem } from "@/lib/utils/staffPerformance";

interface ServiceBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffName: string;
  title: string;
  breakdown: ServiceBreakdownItem[];
}

export function ServiceBreakdownModal({
  isOpen,
  onClose,
  staffName,
  title,
  breakdown,
}: ServiceBreakdownModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const totalSum = breakdown.reduce((sum, item) => sum + item.count, 0);

  const modalJSX = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Dialog Container */}
      <div className="relative w-full max-w-lg rounded-3xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] text-[#A89F8C] z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#2E2B24]">
          <div>
            <h3 className="text-lg font-bold text-[#F5F0E8]">
              {staffName} — {title}
            </h3>
            <p className="text-xs font-semibold text-[#B8962E] mt-0.5">
              Service Performance Breakdown
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid size-9 place-items-center rounded-xl border border-[#2E2B24] bg-[#131210] text-[#A89F8C] transition hover:border-[#B8962E] hover:text-[#B8962E] cursor-pointer"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Total Summary Bar */}
        <div className="my-4 rounded-xl border border-[#2E2B24] bg-[#131210] p-3.5 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#A89F8C]">
            Total Services
          </span>
          <span className="text-base font-black text-[#4ADE80]">
            {totalSum} {totalSum === 1 ? "service" : "services"}
          </span>
        </div>

        {/* Scrollable Breakdown Table */}
        <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-[#2E2B24] bg-[#131210]">
          {breakdown.length === 0 ? (
            <div className="p-8 text-center text-xs italic text-[#6B6358]">
              No service records found.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#0E0D0B] text-[10px] font-bold uppercase tracking-wider text-[#6B6358] border-b border-[#2E2B24] z-10">
                <tr>
                  <th className="px-4 py-3 w-10">#</th>
                  <th className="px-4 py-3">Service Name</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242118] text-[#F5F0E8]">
                {breakdown.map((item, idx) => {
                  const pct = totalSum > 0 ? Math.round((item.count / totalSum) * 100) : 0;
                  return (
                    <tr key={item.name} className="hover:bg-[#1C1A16] transition">
                      <td className="px-4 py-3 font-semibold text-[#6B6358]">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#F5F0E8]">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-[#B8962E]">
                        {item.count}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[#6B6358] text-[11px]">
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-between items-center text-xs text-[#6B6358]">
          <span>Showing {breakdown.length} distinct service types</span>
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-[#2E2B24] bg-[#131210] px-5 text-xs font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalJSX, document.body);
}
