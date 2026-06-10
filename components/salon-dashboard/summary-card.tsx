"use client";

import { Receipt } from "lucide-react";
import type { BillTotals } from "./types";
import { formatCurrency } from "./types";

export function SummaryCard({ totals }: { totals: BillTotals }) {
  const rows = [
    ["Total Services", totals.serviceTotal],
    ["Total Products", totals.productTotal],
    ["Subtotal", totals.subtotal],
    ["Discount", -totals.billDiscount],
  ] as const;

  const grandTotal = Math.max(totals.subtotal - totals.billDiscount, 0);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-md text-stone-900">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-stone-100 text-stone-900">
          <Receipt size={21} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-stone-900">Bill Summary</h2>
          <p className="text-sm text-stone-500">Discounts applied</p>
        </div>
      </div>

      <div className="space-y-3 border-t border-stone-100 pt-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-stone-500">{label}</span>
            <span className={value < 0 ? "font-semibold text-emerald-600" : "font-semibold text-stone-800"}>
              {formatCurrency(value)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4">
        <p className="text-xs uppercase tracking-[0.28em] text-stone-500 font-bold">Grand Total</p>
        <p className="mt-2 text-4xl font-bold tracking-tight text-stone-900">
          {formatCurrency(grandTotal)}
        </p>
      </div>
    </section>
  );
}
