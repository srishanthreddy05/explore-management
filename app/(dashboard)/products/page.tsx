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
  const [formData, setFormData] = useState({
    name: "",
    price: 0,
    quantity: 0,
    type: "retail" as "retail" | "service",
    amount: 0,
    noOfServings: 0,
    brand: "",
    category: "",
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const handleOpenAdd = (type: "retail" | "service" = "retail") => {
    setEditingProduct(null);
    setFormData({
      name: "",
      price: 0,
      quantity: 0,
      type,
      amount: 0,
      noOfServings: 0,
      brand: "",
      category: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price || 0,
      quantity: product.quantity || 0,
      type: product.type || "retail",
      amount: product.amount || 0,
      noOfServings: product.noOfServings || 0,
      brand: product.brand || "",
      category: product.category || "",
    });
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
      const payload = {
        name: formData.name,
        type: formData.type,
        brand: formData.brand.trim() || undefined,
        category: formData.category.trim() || undefined,
        ...(formData.type === "retail" ? {
          price: formData.price,
          quantity: formData.quantity,
          amount: null,
          noOfServings: null,
          costPerServing: null,
        } : {
          price: 0,
          quantity: null,
          amount: formData.amount,
          noOfServings: formData.noOfServings,
          costPerServing: (formData.amount && formData.noOfServings) ? (formData.amount / formData.noOfServings) : 0,
        })
      };

      if (editingProduct?.id) {
        await productsService.update(editingProduct.id, payload);
      } else {
        await productsService.create(payload as Omit<Product, "id">);
      }
      setModalOpen(false);
      await refreshProducts();
    } catch (error) {
      console.error("Failed to save product:", error);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const retailProducts = filteredProducts.filter((p) => !p.type || p.type === "retail");
  const serviceProducts = filteredProducts.filter((p) => p.type === "service");

  return (
    <div className="w-full text-[#A89F8C] space-y-8">
      {/* Title */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">
            Inventory
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#F5F0E8]">
            Products & Supplies ({products.length})
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-[#B8962E] border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="flex max-w-md items-center rounded-xl border border-[#2E2B24] bg-[#131210] px-4 h-12 shadow-sm focus-within:border-[#B8962E] transition">
            <Search size={18} className="text-[#6B6358] mr-2" />
            <input
              type="text"
              placeholder="Search products & supplies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-[#F5F0E8] outline-none placeholder:text-[#6B6358]"
            />
          </div>

          {/* Retail Products Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#2E2B24] pb-2">
              <h2 className="text-lg font-bold text-[#F5F0E8]">Retail Inventory ({retailProducts.length})</h2>
              <button
                onClick={() => handleOpenAdd("retail")}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-xs font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] shadow-sm transition duration-150 cursor-pointer"
              >
                <Plus size={15} />
                Add Retail Product
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#131210] shadow-md">
              <table className="w-full min-w-[800px] border-collapse text-left text-sm text-[#A89F8C]">
                <thead className="bg-[#0E0D0B] text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C] border-b border-[#2E2B24]">
                  <tr>
                    <th className="px-6 py-4 font-bold">Product Name</th>
                    <th className="px-6 py-4 font-bold">Price</th>
                    <th className="px-6 py-4 font-bold">Stock Level</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2E2B24]">
                  {retailProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-[#6B6358] italic bg-transparent">
                        No retail products found.
                      </td>
                    </tr>
                  ) : (
                    retailProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-[#1C1A16] transition bg-transparent text-[#A89F8C]">
                        <td className="px-6 py-4 font-semibold text-[#F5F0E8]">
                          <div>{product.name}</div>
                          {(product.brand || product.category) && (
                            <div className="text-[10px] text-stone-500 font-medium mt-0.5 space-x-1.5">
                              {product.brand && <span>Brand: {product.brand}</span>}
                              {product.brand && product.category && <span>•</span>}
                              {product.category && <span>Category: {product.category}</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-[#F5F0E8] font-semibold">{formatCurrency(product.price)}</td>
                        <td className="px-6 py-4">{(product.quantity ?? 0)} items</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-bold border ${
                              (product.quantity ?? 0) <= 0
                                ? "bg-[#1A1814] text-[#E57373] border border-[#E57373]/20"
                                : (product.quantity ?? 0) <= 5
                                  ? "bg-[#1A1814] text-[#B8962E] border border-[#B8962E]/20 animate-pulse"
                                  : "bg-[#1F1A0F] text-[#B8962E] border border-[#B8962E]/20"
                            }`}
                          >
                            {(product.quantity ?? 0) <= 0 ? "Out of Stock" : (product.quantity ?? 0) <= 5 ? "Low Stock" : "In Stock"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(product)}
                              className="grid size-9 place-items-center rounded-xl bg-[#131210] border border-[#2E2B24] text-[#B8962E] hover:bg-[#1F1A0F] hover:border-[#B8962E] transition cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => product.id && handleDeleteTrigger(product.id)}
                              className="grid size-9 place-items-center rounded-xl bg-[#131210] border border-[#2E2B24] text-[#E57373] hover:bg-[#131210] hover:border-[#E57373] transition cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Service Products Section */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between border-b border-[#2E2B24] pb-2">
              <h2 className="text-lg font-bold text-[#F5F0E8]">Service Supplies (Used in Services) ({serviceProducts.length})</h2>
              <button
                onClick={() => handleOpenAdd("service")}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-xs font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] shadow-sm transition duration-150 cursor-pointer"
              >
                <Plus size={15} />
                Add Service Product
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#131210] shadow-md">
              <table className="w-full min-w-[800px] border-collapse text-left text-sm text-[#A89F8C]">
                <thead className="bg-[#0E0D0B] text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C] border-b border-[#2E2B24]">
                  <tr>
                    <th className="px-6 py-4 font-bold">Supply Name</th>
                    <th className="px-6 py-4 font-bold">Cost Amount</th>
                    <th className="px-6 py-4 font-bold">Cost Per Serving</th>
                    <th className="px-6 py-4 font-bold">Servings Left</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2E2B24]">
                  {serviceProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-[#6B6358] italic bg-transparent">
                        No service supplies created yet.
                      </td>
                    </tr>
                  ) : (
                    serviceProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-[#1C1A16] transition bg-transparent text-[#A89F8C]">
                        <td className="px-6 py-4 font-semibold text-[#F5F0E8]">
                          <div>{product.name}</div>
                          {(product.brand || product.category) && (
                            <div className="text-[10px] text-stone-500 font-medium mt-0.5 space-x-1.5">
                              {product.brand && <span>Brand: {product.brand}</span>}
                              {product.brand && product.category && <span>•</span>}
                              {product.category && <span>Category: {product.category}</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-[#F5F0E8] font-semibold">{formatCurrency(product.amount || 0)}</td>
                        <td className="px-6 py-4 text-[#F5F0E8] font-semibold text-stone-600">
                          {formatCurrency(product.costPerServing || 0)}
                        </td>
                        <td className="px-6 py-4">{product.noOfServings || 0} servings</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-bold border ${
                              (!product.noOfServings || product.noOfServings <= 0)
                                ? "bg-[#1A1814] text-[#E57373] border border-[#E57373]/20"
                                : product.noOfServings <= 3
                                  ? "bg-[#1A1814] text-[#B8962E] border border-[#B8962E]/20 animate-pulse"
                                  : "bg-[#1F1A0F] text-[#B8962E] border border-[#B8962E]/20"
                            }`}
                          >
                            {(!product.noOfServings || product.noOfServings <= 0) ? "Depleted" : product.noOfServings <= 3 ? "Low Servings" : "Available"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(product)}
                              className="grid size-9 place-items-center rounded-xl bg-[#131210] border border-[#2E2B24] text-[#B8962E] hover:bg-[#1F1A0F] hover:border-[#B8962E] transition cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => product.id && handleDeleteTrigger(product.id)}
                              className="grid size-9 place-items-center rounded-xl bg-[#131210] border border-[#2E2B24] text-[#E57373] hover:bg-[#131210] hover:border-[#E57373] transition cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#A89F8C] z-10 animate-in zoom-in-95 duration-200">
            <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-[#A89F8C] hover:text-[#B8962E] transition cursor-pointer">
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-[#F5F0E8] mb-4">
              {editingProduct 
                ? "Edit Details" 
                : formData.type === "retail" 
                  ? "Add Retail Product" 
                  : "Add Service Supply"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Name</span>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E] placeholder-[#6B6358]"
                  placeholder={formData.type === "retail" ? "e.g. Keratin Repair Serum" : "e.g. Hair Color Tube / Shampoo"}
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Brand</span>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E] placeholder-[#6B6358]"
                  placeholder="e.g. L'Oreal, Wella"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Category</span>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E] placeholder-[#6B6358]"
                  placeholder="e.g. Shampoo, Hair Color"
                />
              </label>

              {formData.type === "retail" ? (
                <>
                  <label className="block">
                    <span className="text-sm font-semibold text-[#A89F8C]">Retail Price (₹)</span>
                    <input
                      required
                      type="number"
                      min="0"
                      value={formData.price === 0 ? "" : formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-[#A89F8C]">In-Stock Quantity</span>
                    <input
                      required
                      type="number"
                      min="0"
                      value={formData.quantity === 0 ? "" : formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="block">
                    <span className="text-sm font-semibold text-[#A89F8C]">Cost Amount (₹)</span>
                    <input
                      required
                      type="number"
                      min="0"
                      value={formData.amount === 0 ? "" : formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-[#A89F8C]">Number of Servings</span>
                    <input
                      required
                      type="number"
                      min="1"
                      value={formData.noOfServings === 0 ? "" : formData.noOfServings}
                      onChange={(e) => setFormData({ ...formData, noOfServings: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-[#A89F8C]">Cost Per Serving (₹ - Auto-calculated)</span>
                    <input
                      readOnly
                      type="text"
                      value={formData.noOfServings > 0 ? formatCurrency(formData.amount / formData.noOfServings) : "—"}
                      className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#A89F8C] outline-none"
                    />
                  </label>
                </>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-11 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-[#B8962E] px-6 text-sm font-bold text-[#0E0D0B] hover:bg-[#D4A935] shadow-[0_4px_16px_rgba(184,150,46,0.25)] transition disabled:opacity-50 cursor-pointer"
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
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteConfirmOpen(false)} />
          <div className="relative w-full max-w-sm rounded-3xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#A89F8C] z-10 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#F5F0E8]">Remove this product?</h3>
            <p className="mt-2 text-sm text-[#A89F8C]">
              The product will be hidden from billing and inventory. Historical invoices that include it will not be affected.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="h-10 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-xs font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="h-10 rounded-xl bg-[#E57373] hover:bg-[#ef5350] px-4 text-xs font-bold text-[#0E0D0B] shadow-sm transition cursor-pointer"
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