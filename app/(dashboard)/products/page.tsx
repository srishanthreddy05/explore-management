"use client";

import { useState } from "react";
import * as productsService from "@/services/products";
import { useAppData } from "@/context/AppDataContext";
import type { Product } from "@/types/product";
import { Plus, Search, Edit2, Trash2, X, Package } from "lucide-react";
import { formatCurrency } from "@/components/salon-dashboard/types";

export default function ProductsPage() {
  const { products, refreshProducts, loadingAppData } = useAppData();
  const loading = loadingAppData;
  const [searchQuery, setSearchQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({ name: "", price: 0, quantity: 0 });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({ name: "", price: 0, quantity: 0 });
    setModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({ name: product.name, price: product.price, quantity: product.quantity });
    setModalOpen(true);
  };

  const handleDeleteTrigger = (id: string) => {
    setIdToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!idToDelete) return;
    try {
      // ── FIX: soft delete — sets isActive: false, preserves Firestore doc ──
      await productsService.delete(idToDelete);
      setDeleteConfirmOpen(false);
      setIdToDelete(null);
      await refreshProducts();
    } catch (error) {
      console.error("Failed to soft-delete product:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct?.id) {
        await productsService.update(editingProduct.id, formData);
      } else {
        await productsService.create(formData);
      }
      setModalOpen(false);
      await refreshProducts();
    } catch (error) {
      console.error("Failed to save product:", error);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full text-stone-900">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-stone-500">
            Inventory
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            Products ({products.length})
          </h1>
        </div>
        {!loading && products.length > 0 && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-850"
          >
            <Plus size={18} />
            Add Product
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-md">
          <div className="grid size-16 place-items-center rounded-2xl bg-stone-100 text-stone-900 mb-4">
            <Package size={32} />
          </div>
          <h2 className="text-xl font-bold text-stone-900">No Products Found</h2>
          <p className="mt-2 max-w-sm text-sm text-stone-500">
            Define your retail product inventory and track stock counts to supply items to salon billing.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-850"
          >
            <Plus size={18} />
            Add Product
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex max-w-md items-center rounded-2xl border border-stone-200 bg-white px-4 h-12 shadow-sm focus-within:border-black">
            <Search size={18} className="text-stone-400 mr-2" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-md">
            <table className="w-full min-w-[800px] border-collapse text-left text-sm text-stone-600">
              <thead className="bg-stone-55 text-xs uppercase tracking-[0.2em] text-stone-550 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-4 font-bold">Product Name</th>
                  <th className="px-6 py-4 font-bold">Price</th>
                  <th className="px-6 py-4 font-bold">Stock Level</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-stone-50 transition bg-white text-stone-900">
                    <td className="px-6 py-4 font-semibold text-stone-900">{product.name}</td>
                    <td className="px-6 py-4 text-stone-900 font-semibold">{formatCurrency(product.price)}</td>
                    <td className="px-6 py-4">{product.quantity} items</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${product.quantity <= 0
                            ? "bg-red-100 text-red-800 border border-red-300"
                            : product.quantity <= 5
                              ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          }`}
                      >
                        {product.quantity <= 0 ? "Out of Stock" : product.quantity <= 5 ? "Low Stock" : "In Stock"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(product)}
                          className="grid size-10 place-items-center rounded-xl border border-stone-200 text-stone-400 hover:text-black hover:border-black transition"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => product.id && handleDeleteTrigger(product.id)}
                          className="grid size-10 place-items-center rounded-xl border border-stone-200 text-stone-400 hover:text-red-650 hover:border-red-500 hover:bg-red-50 transition"
                          title="Remove from active inventory"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-stone-250 bg-white p-6 shadow-2xl text-stone-900">
            <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-stone-400 hover:text-black">
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-stone-900 mb-4">
              {editingProduct ? "Edit Product Details" : "Add Inventory Product"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Product Name</span>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  placeholder="e.g. Keratin Repair Serum"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Retail Price (INR)</span>
                <input
                  required
                  type="number"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">In-Stock Quantity</span>
                <input
                  required
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                />
              </label>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-11 rounded-xl border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-black px-6 text-sm font-semibold text-white hover:bg-stone-850 transition"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirmOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-stone-250 bg-white p-6 shadow-2xl text-stone-900 z-10">
            <h3 className="text-lg font-bold text-stone-900">Remove this product?</h3>
            <p className="mt-2 text-sm text-stone-500">
              The product will be hidden from billing and inventory. Historical invoices that include it will not be affected.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="h-10 rounded-xl border border-stone-200 px-4 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="h-10 rounded-xl bg-red-600 hover:bg-red-700 px-4 text-xs font-semibold text-white shadow-sm transition"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}