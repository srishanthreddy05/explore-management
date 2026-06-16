"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { ServiceRow } from "./types";
import { formatCurrency } from "./types";

interface BillingTableProps {
  rows: ServiceRow[];
  onRowsChange: (rows: ServiceRow[]) => void;
  serviceOptions?: { name: string; price: number; category?: string }[];
  staffOptions?: string[];
  disabled?: boolean;
  serviceProductOptions?: { id: string; name: string; noOfServings: number }[];
}

export function BillingTable({
  rows,
  onRowsChange,
  serviceOptions = [],
  staffOptions = [],
  disabled = false,
  serviceProductOptions = [],
}: BillingTableProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedCat, setSelectedCat] = useState("All");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateRow = (id: number, patch: Partial<ServiceRow>) => {
    onRowsChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const selectService = (svc: { name: string; price: number }) => {
    const firstStaff = staffOptions[0] || "";
    onRowsChange([
      ...rows,
      {
        id: Math.max(0, ...rows.map((row) => row.id)) + 1,
        service: svc.name,
        staff: firstStaff,
        price: svc.price,
        quantity: 1,
        discount: 0,
      },
    ]);
    setShowModal(false);
  };

  // Extract unique categories
  const categories = ["All", ...Array.from(new Set(serviceOptions.map(s => s.category || "General")))];

  // Filtered services
  const filteredServices = selectedCat === "All"
    ? serviceOptions
    : serviceOptions.filter(s => (s.category || "General") === selectedCat);

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-stone-900">Services</h2>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowModal(true)}
          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-black shadow-sm transition hover:-translate-y-0.5 hover:bg-stone-50 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Plus size={17} />
          Add Service
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[700px] table-fixed border-collapse text-left text-sm">
          <thead className="bg-stone-55 text-xs uppercase tracking-[0.2em] text-stone-500 border-b border-stone-200">
            <tr>
              <th className="px-2 py-3 font-semibold">Service</th>
              <th className="px-2 py-3 font-semibold w-[130px]">Staff</th>
              <th className="px-2 py-3 font-semibold w-[160px]">Used Product</th>
              <th className="px-2 py-3 font-semibold w-[90px]">Price</th>
              <th className="px-2 py-3 font-semibold w-[90px]">Discount</th>
              <th className="px-2 py-3 font-semibold w-[90px]">Amount</th>
              <th className="px-2 py-3 font-semibold w-[50px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {rows.map((row) => (
              <tr key={row.id} className="bg-white transition hover:bg-stone-50">
                <td className="px-2 py-2 font-bold text-stone-900 truncate" title={row.service}>
                  {row.service}
                </td>
                <td className="px-2 py-2 w-[130px]">
                  <select
                    value={row.staff}
                    disabled={disabled}
                    onChange={(event) => updateRow(row.id, { staff: event.target.value })}
                    className="h-10 w-full rounded-xl border border-stone-200 bg-stone-50 px-2.5 text-stone-900 outline-none transition focus:border-black focus:bg-white disabled:bg-stone-100 disabled:text-stone-500 text-xs font-semibold cursor-pointer shadow-2xs"
                  >
                    {staffOptions.length === 0 && <option value="">No Options</option>}
                    {staffOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 w-[160px]">
                  <select
                    value={row.usedProductId || ""}
                    disabled={disabled}
                    onChange={(event) => {
                      const val = event.target.value;
                      const matched = serviceProductOptions.find(p => p.id === val);
                      updateRow(row.id, {
                        usedProductId: val || undefined,
                        usedProductName: matched?.name || undefined
                      });
                    }}
                    className="h-10 w-full rounded-xl border border-stone-200 bg-stone-50 px-2.5 text-stone-900 outline-none transition focus:border-black focus:bg-white disabled:bg-stone-100 disabled:text-stone-500 text-xs font-semibold cursor-pointer shadow-2xs"
                  >
                    <option value="">No Product</option>
                    {serviceProductOptions.map((option) => (
                      <option key={option.id} value={option.id} disabled={option.noOfServings <= 0}>
                        {option.name} ({option.noOfServings} left)
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 w-[90px]">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    disabled={disabled}
                    value={row.price === 0 ? "" : row.price}
                    onChange={(event) => updateRow(row.id, { price: event.target.value === "" ? 0 : Number(event.target.value) })}
                    className="h-10 w-full rounded-xl border border-stone-200 bg-stone-50 px-2 text-stone-900 outline-none transition focus:border-black focus:bg-white disabled:bg-stone-100 disabled:text-stone-500 text-xs font-semibold shadow-2xs"
                  />
                </td>
                <td className="px-2 py-2 w-[90px]">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    disabled={disabled}
                    value={row.discount === 0 ? "" : row.discount}
                    onChange={(event) => updateRow(row.id, { discount: event.target.value === "" ? 0 : Number(event.target.value) })}
                    className="h-10 w-full rounded-xl border border-stone-200 bg-stone-50 px-2 text-stone-900 outline-none transition focus:border-black focus:bg-white disabled:bg-stone-100 disabled:text-stone-500 text-xs font-semibold shadow-2xs"
                  />
                </td>
                <td className="px-2 py-2 font-bold text-stone-900 text-xs w-[90px]">
                  {formatCurrency(Math.max(row.price - row.discount, 0))}
                </td>
                <td className="px-2 py-2 text-right w-[50px]">
                  <button
                    aria-label="Delete row"
                    type="button"
                    disabled={disabled}
                    onClick={() => onRowsChange(rows.filter((item) => item.id !== row.id))}
                    className="grid size-9 place-items-center rounded-xl border border-stone-200 text-stone-400 transition hover:border-red-500 hover:bg-red-50 hover:text-red-650 disabled:opacity-50 disabled:pointer-events-none mx-auto"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Select Service Modal Overlay */}
      {showModal && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-stone-250 bg-white p-6 shadow-2xl text-stone-900 flex flex-col max-h-[85vh]">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-black"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-xl font-bold text-stone-900 mb-4">Select Service Menu</h2>
            
            {/* Category Filter Chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCat(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    selectedCat === cat
                      ? "bg-black text-white border-black"
                      : "bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-400"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Service Cards Grid Container */}
            <div className="flex-1 overflow-y-auto pr-1">
              {filteredServices.length === 0 ? (
                <p className="text-sm text-stone-400 italic text-center py-8">No services in this category.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {filteredServices.map(svc => (
                    <div
                      key={svc.name}
                      onClick={() => selectService(svc)}
                      className="cursor-pointer rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-black hover:shadow-md"
                    >
                      <span className="inline-block rounded-full bg-stone-50 border border-stone-200 px-2 py-0.5 text-[9px] font-bold text-stone-500 uppercase tracking-wider">
                        {svc.category || "General"}
                      </span>
                      <h3 className="mt-2 text-sm font-bold text-stone-900 truncate" title={svc.name}>{svc.name}</h3>
                      <p className="mt-1 text-sm font-semibold text-stone-850">{formatCurrency(svc.price)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
