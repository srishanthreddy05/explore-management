"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { ProductRow } from "./types";
import { formatCurrency } from "./types";

interface ProductTableProps {
  rows: ProductRow[];
  onRowsChange: (rows: ProductRow[]) => void;
  productOptions?: { id?: string; name: string; price: number }[];
  disabled?: boolean;
}

export function ProductTable({
  rows,
  onRowsChange,
  productOptions = [],
  disabled = false,
}: ProductTableProps) {
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateRow = (id: number, patch: Partial<ProductRow>) => {
    onRowsChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const selectProduct = (prod: { id?: string; name: string; price: number }) => {
    onRowsChange([
      ...rows,
      {
        id: Math.max(0, ...rows.map((row) => row.id)) + 1,
        productId: prod.id || "",
        product: prod.name,
        price: prod.price,
        quantity: 1,
        discount: 0,
      },
    ]);
    setShowModal(false);
  };

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#F5F0E8]">Products</h2>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowModal(true)}
          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#2E2B24] bg-[#131210] px-4 text-sm font-semibold text-[#A89F8C] transition hover:-translate-y-0.5 hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          <Plus size={17} />
          Add Product
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#1C1A16]">
        <table className="w-full min-w-[700px] table-fixed border-collapse text-left text-sm text-[#A89F8C]">
          <thead className="bg-[#131210] text-xs uppercase tracking-[0.2em] text-[#6B6358] border-b border-[#2E2B24]">
            <tr>
              <th className="px-2 py-3 font-bold">Product</th>
              <th className="px-2 py-3 font-bold w-[130px]"></th>
              <th className="px-2 py-3 font-bold w-[160px]">Quantity</th>
              <th className="px-2 py-3 font-bold w-[90px]">Price</th>
              <th className="px-2 py-3 font-bold w-[90px]">Discount</th>
              <th className="px-2 py-3 font-bold w-[90px]">Amount</th>
              <th className="px-2 py-3 font-bold w-[50px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2E2B24]">
            {rows.map((row) => (
              <tr key={row.id} className="bg-transparent transition hover:bg-[#1F1A0F]">
                <td className="px-2 py-2 font-bold text-[#F5F0E8] truncate" title={row.product}>
                  {row.product}
                </td>
                <td className="px-2 py-2 w-[130px]" />
                <td className="px-2 py-2 w-[160px]">
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    disabled={disabled}
                    value={row.quantity === 0 ? "" : row.quantity}
                    onChange={(event) => updateRow(row.id, { quantity: event.target.value === "" ? 0 : Number(event.target.value) })}
                    className="h-10 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-2 text-[#F5F0E8] outline-none transition focus:border-[#B8962E] disabled:bg-[#0E0D0B] disabled:text-[#6B6358] text-xs font-semibold"
                  />
                </td>
                <td className="px-2 py-2 w-[90px]">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    disabled={disabled}
                    value={row.price === 0 ? "" : row.price}
                    onChange={(event) => updateRow(row.id, { price: event.target.value === "" ? 0 : Number(event.target.value) })}
                    className="h-10 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-2 text-[#F5F0E8] outline-none transition focus:border-[#B8962E] disabled:bg-[#0E0D0B] disabled:text-[#6B6358] text-xs font-semibold"
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
                    className="h-10 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-2 text-[#F5F0E8] outline-none transition focus:border-[#B8962E] disabled:bg-[#0E0D0B] disabled:text-[#6B6358] text-xs font-semibold"
                  />
                </td>
                <td className="px-2 py-2 font-bold text-[#F5F0E8] text-xs w-[90px]">
                  {formatCurrency(Math.max(row.price * row.quantity - row.discount, 0))}
                </td>
                <td className="px-2 py-2 text-right w-[50px]">
                  <button
                    aria-label="Delete product"
                    type="button"
                    disabled={disabled}
                    onClick={() => onRowsChange(rows.filter((item) => item.id !== row.id))}
                    className="grid size-9 place-items-center rounded-xl border border-[#5C2424] text-[#E57373] bg-[#2E1616] transition hover:bg-[#471C1C] disabled:opacity-50 disabled:pointer-events-none mx-auto cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Select Product Modal Overlay */}
      {showModal && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#F5F0E8] flex flex-col max-h-[85vh]">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-[#A89F8C] hover:text-[#B8962E] transition"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-[#F5F0E8] mb-4">Select Product</h2>

            <div className="flex-1 overflow-y-auto pr-1">
              {productOptions.length === 0 ? (
                <p className="text-sm text-[#6B6358] italic text-center py-8">No products in catalog.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {productOptions.map((prod) => (
                    <div
                      key={prod.name}
                      onClick={() => selectProduct(prod)}
                      className="cursor-pointer rounded-2xl border border-[#2E2B24] bg-[#131210] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#B8962E] hover:shadow-[0_4px_16px_rgba(184,150,46,0.12)]"
                    >
                      <h3 className="text-sm font-bold text-[#F5F0E8] truncate" title={prod.name}>
                        {prod.name}
                      </h3>
                      <p className="mt-1 text-sm font-bold text-[#B8962E]">
                        {formatCurrency(prod.price)}
                      </p>
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