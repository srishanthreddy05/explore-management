"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ProductRow } from "./types";
import { formatCurrency } from "./types";

interface ProductTableProps {
  rows: ProductRow[];
  onRowsChange: (rows: ProductRow[]) => void;
  productOptions?: { name: string; price: number }[];
}

export function ProductTable({
  rows,
  onRowsChange,
  productOptions = [],
}: ProductTableProps) {
  const [showModal, setShowModal] = useState(false);

  const updateRow = (id: number, patch: Partial<ProductRow>) => {
    onRowsChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const selectProduct = (prod: { name: string; price: number }) => {
    onRowsChange([
      ...rows,
      {
        id: Math.max(0, ...rows.map((row) => row.id)) + 1,
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
        <h2 className="text-lg font-bold text-stone-900">Products</h2>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-black px-4 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-800"
        >
          <Plus size={17} />
          Add Product
        </button>
      </div>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[700px] border-collapse text-left text-sm">
          <thead className="bg-stone-55 text-xs uppercase tracking-[0.2em] text-stone-500 border-b border-stone-200">
            <tr>
              {["Product", "Price", "Quantity", "Discount", "Amount", ""].map((heading) => (
                <th key={heading} className="px-4 py-4 font-semibold">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {rows.map((row) => (
              <tr key={row.id} className="bg-white transition hover:bg-stone-50">
                <td className="px-4 py-3 font-semibold text-stone-900">
                  {row.product}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    value={row.price}
                    onChange={(event) => updateRow(row.id, { price: Number(event.target.value) })}
                    className="h-10 w-28 rounded-xl border border-stone-200 bg-stone-50 px-3 text-stone-900 outline-none transition focus:border-black"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="1"
                    value={row.quantity}
                    onChange={(event) => updateRow(row.id, { quantity: Number(event.target.value) })}
                    className="h-10 w-28 rounded-xl border border-stone-200 bg-stone-50 px-3 text-stone-900 outline-none transition focus:border-black"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    value={row.discount}
                    onChange={(event) => updateRow(row.id, { discount: Number(event.target.value) })}
                    className="h-10 w-28 rounded-xl border border-stone-200 bg-stone-50 px-3 text-stone-900 outline-none transition focus:border-black"
                  />
                </td>
                <td className="px-4 py-3 font-semibold text-stone-900">
                  {formatCurrency(Math.max(row.price * row.quantity - row.discount, 0))}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    aria-label="Delete product"
                    type="button"
                    onClick={() => onRowsChange(rows.filter((item) => item.id !== row.id))}
                    className="grid size-10 place-items-center rounded-xl border border-stone-200 text-stone-400 transition hover:border-red-500 hover:bg-red-55 hover:text-red-650"
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
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-stone-250 bg-white p-6 shadow-2xl text-stone-900 flex flex-col max-h-[85vh]">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-black"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-xl font-bold text-stone-900 mb-4">Select Product</h2>
            
            <div className="flex-1 overflow-y-auto pr-1">
              {productOptions.length === 0 ? (
                <p className="text-sm text-stone-400 italic text-center py-8">No products in catalog.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {productOptions.map((prod) => (
                    <div
                      key={prod.name}
                      onClick={() => selectProduct(prod)}
                      className="cursor-pointer rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-black hover:shadow-md"
                    >
                      <h3 className="text-sm font-bold text-stone-900 truncate" title={prod.name}>
                        {prod.name}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-stone-850">
                        {formatCurrency(prod.price)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
