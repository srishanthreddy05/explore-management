"use client";

import { useState } from "react";
import * as productsService from "@/services/products";
import { useAppData } from "@/context/AppDataContext";
import type { Product } from "@/types/product";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  PackagePlus,
  RotateCcw,
  Info,
  CheckCircle2,
  AlertCircle,
  History,
} from "lucide-react";
import { formatCurrency } from "@/components/salon-dashboard/types";
import {
  computeCostPerServing,
  computeRefillCostPerServing,
  getEffectiveCostPerServing,
  resolveProductOriginalServings,
  validateRefillInput,
} from "@/lib/utils/servingCost";
import { toast } from "react-hot-toast";

export default function ProductsPage() {
  const { products, refreshProducts, loadingAppData } = useAppData();
  const loading = loadingAppData;
  const [searchQuery, setSearchQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit" | "refill">("add");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form data for creating or editing product metadata
  const [formData, setFormData] = useState({
    name: "",
    price: 0,
    quantity: 0,
    type: "retail" as "retail" | "service",
    amount: 0,
    originalServings: 0,
    noOfServings: 0,
    brand: "",
    category: "",
  });

  // State for the dedicated Refill Stock feature
  const [refillData, setRefillData] = useState<{
    additionalServings: number | "";
    refillCost: number | "";
    notes: string;
  }>({
    additionalServings: "",
    refillCost: "",
    notes: "",
  });

  const [showRefillHistory, setShowRefillHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  // Open Add modal
  const handleOpenAdd = (type: "retail" | "service" = "retail") => {
    setEditingProduct(null);
    setModalMode("add");
    setFormData({
      name: "",
      price: 0,
      quantity: 0,
      type,
      amount: 0,
      originalServings: 0,
      noOfServings: 0,
      brand: "",
      category: "",
    });
    setModalOpen(true);
  };

  // Open Edit modal (focuses on metadata, displays purchase history & current stock read-only)
  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setModalMode("edit");
    setShowRefillHistory(false);
    const resolvedOriginal = resolveProductOriginalServings(product);
    setFormData({
      name: product.name,
      price: product.price || 0,
      quantity: product.quantity || 0,
      type: product.type || "retail",
      amount: product.amount || 0,
      originalServings: resolvedOriginal,
      noOfServings: product.noOfServings ?? 0,
      brand: product.brand || "",
      category: product.category || "",
    });
    setModalOpen(true);
  };

  // Open Refill Stock view
  const handleOpenRefill = (product: Product) => {
    setEditingProduct(product);
    setModalMode("refill");
    setShowRefillHistory(false);
    setRefillData({
      additionalServings: "",
      refillCost: "",
      notes: "",
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
      await productsService.delete(idToDelete);
      setDeleteConfirmOpen(false);
      setIdToDelete(null);
      toast.success("Product removed successfully.");
      await refreshProducts();
    } catch (error) {
      console.error("Failed to soft-delete product:", error);
      toast.error("Failed to remove product.");
    }
  };

  // Handle Save (Add new product OR Save edited details)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);

      if (formData.type === "service") {
        if (!formData.name.trim()) {
          toast.error("Product name is required.");
          setSubmitting(false);
          return;
        }

        if (!editingProduct) {
          // Creating new service product
          if (!formData.originalServings || formData.originalServings <= 0) {
            toast.error("Original purchased servings must be greater than 0.");
            setSubmitting(false);
            return;
          }
          if (!formData.amount || formData.amount <= 0) {
            toast.error("Cost amount must be greater than 0.");
            setSubmitting(false);
            return;
          }
        }
      }

      if (editingProduct?.id) {
        // EDIT MODE:
        if (editingProduct.type === "service") {
          // IMPORTANT: Ordinary metadata edits NEVER overwrite stock, purchase cost, or unit cost.
          // Stock can only be increased via the dedicated Refill Stock feature.
          await productsService.update(editingProduct.id, {
            name: formData.name.trim(),
            brand: formData.brand.trim() || undefined,
            category: formData.category.trim() || undefined,
          });
          toast.success("Product details updated successfully.");
        } else {
          // Retail product edit
          await productsService.update(editingProduct.id, {
            name: formData.name.trim(),
            price: formData.price,
            quantity: formData.quantity,
            brand: formData.brand.trim() || undefined,
            category: formData.category.trim() || undefined,
          });
          toast.success("Retail product updated successfully.");
        }
      } else {
        // CREATE MODE:
        if (formData.type === "retail") {
          await productsService.create({
            name: formData.name.trim(),
            price: formData.price,
            quantity: formData.quantity,
            type: "retail",
            brand: formData.brand.trim() || undefined,
            category: formData.category.trim() || undefined,
            amount: null,
            originalServings: null,
            noOfServings: null,
            costPerServing: null,
          });
          toast.success("Retail product created successfully.");
        } else {
          const originalServings = formData.originalServings;
          const costPerServing = computeCostPerServing(formData.amount, originalServings);
          await productsService.create({
            name: formData.name.trim(),
            price: 0,
            type: "service",
            brand: formData.brand.trim() || undefined,
            category: formData.category.trim() || undefined,
            amount: formData.amount,
            originalServings,
            noOfServings: originalServings,
            costPerServing,
          });
          toast.success("Service supply added successfully.");
        }
      }

      setModalOpen(false);
      await refreshProducts();
    } catch (error: any) {
      console.error("Failed to save product:", error);
      toast.error(error?.message || "Failed to save product.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Confirm Refill Stock
  const handleConfirmRefill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.id || submitting) return;

    const srv = Number(refillData.additionalServings);
    const cost = Number(refillData.refillCost);

    const validation = validateRefillInput(srv, cost);
    if (!validation.valid) {
      toast.error(validation.error || "Please provide valid refill numbers.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await productsService.refillStock(editingProduct.id, {
        additionalServings: srv,
        refillCost: cost,
        notes: refillData.notes,
      });

      toast.success(
        `Refilled ${editingProduct.name}! Added ${srv} servings. New unit cost: ${formatCurrency(result.updatedProduct.costPerServing || 0)}.`
      );
      setModalOpen(false);
      await refreshProducts();
    } catch (error: any) {
      console.error("Failed to refill stock:", error);
      toast.error(error?.message || "Failed to refill stock.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const retailProducts = filteredProducts.filter((p) => !p.type || p.type === "retail");
  const serviceProducts = filteredProducts.filter((p) => p.type === "service");

  // Live refill calculations
  const activeUnitCost = editingProduct ? getEffectiveCostPerServing(editingProduct) : 0;
  const currentRemainingServings = editingProduct?.noOfServings ?? 0;
  const additionalServingsNum = Number(refillData.additionalServings);
  const refillCostNum = Number(refillData.refillCost);

  let refillPreview = null;
  if (
    modalMode === "refill" &&
    Number.isInteger(additionalServingsNum) &&
    additionalServingsNum > 0 &&
    !isNaN(refillCostNum) &&
    refillCostNum >= 0
  ) {
    try {
      refillPreview = computeRefillCostPerServing(
        currentRemainingServings,
        activeUnitCost,
        additionalServingsNum,
        refillCostNum
      );
    } catch {
      refillPreview = null;
    }
  }

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
              <h2 className="text-lg font-bold text-[#F5F0E8]">
                Retail Inventory ({retailProducts.length})
              </h2>
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
                      <td
                        colSpan={5}
                        className="px-6 py-8 text-center text-[#6B6358] italic bg-transparent"
                      >
                        No retail products found.
                      </td>
                    </tr>
                  ) : (
                    retailProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="hover:bg-[#1C1A16] transition bg-transparent text-[#A89F8C]"
                      >
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
                        <td className="px-6 py-4 text-[#F5F0E8] font-semibold">
                          {formatCurrency(product.price)}
                        </td>
                        <td className="px-6 py-4">{(product.quantity ?? 0)} items</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-bold border ${
                              (product.quantity ?? 0) <= 0
                                ? "bg-[#1A1814] text-[#E57373] border-[#E57373]/20"
                                : (product.quantity ?? 0) <= 5
                                ? "bg-[#1A1814] text-[#B8962E] border-[#B8962E]/20 animate-pulse"
                                : "bg-[#1F1A0F] text-[#B8962E] border-[#B8962E]/20"
                            }`}
                          >
                            {(product.quantity ?? 0) <= 0
                              ? "Out of Stock"
                              : (product.quantity ?? 0) <= 5
                              ? "Low Stock"
                              : "In Stock"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(product)}
                              className="grid size-9 place-items-center rounded-xl bg-[#131210] border border-[#2E2B24] text-[#B8962E] hover:bg-[#1F1A0F] hover:border-[#B8962E] transition cursor-pointer"
                              title="Edit Details"
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
              <div>
                <h2 className="text-lg font-bold text-[#F5F0E8]">
                  Service Supplies (Used in Services) ({serviceProducts.length})
                </h2>
                <p className="text-xs text-[#6B6358] mt-0.5">
                  Stock consumed during services automatically deducts servings without altering historical purchase cost.
                </p>
              </div>
              <button
                onClick={() => handleOpenAdd("service")}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-xs font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] shadow-sm transition duration-150 cursor-pointer"
              >
                <Plus size={15} />
                Add Service Product
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#131210] shadow-md">
              <table className="w-full min-w-[850px] border-collapse text-left text-sm text-[#A89F8C]">
                <thead className="bg-[#0E0D0B] text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C] border-b border-[#2E2B24]">
                  <tr>
                    <th className="px-6 py-4 font-bold">Supply Name</th>
                    <th className="px-6 py-4 font-bold">Initial Cost</th>
                    <th className="px-6 py-4 font-bold">Cost Per Serving</th>
                    <th className="px-6 py-4 font-bold">Servings Left</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2E2B24]">
                  {serviceProducts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-[#6B6358] italic bg-transparent"
                      >
                        No service supplies created yet.
                      </td>
                    </tr>
                  ) : (
                    serviceProducts.map((product) => {
                      const effectiveUnitCost = getEffectiveCostPerServing(product);
                      const servingsLeft = product.noOfServings ?? 0;
                      return (
                        <tr
                          key={product.id}
                          className="hover:bg-[#1C1A16] transition bg-transparent text-[#A89F8C]"
                        >
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
                          <td className="px-6 py-4 text-[#F5F0E8] font-semibold">
                            {formatCurrency(product.amount || 0)}
                          </td>
                          <td className="px-6 py-4 text-[#F5F0E8] font-semibold">
                            {formatCurrency(effectiveUnitCost)}
                            <span className="text-[11px] font-normal text-[#6B6358] ml-1">
                              / serving
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-semibold text-[#F5F0E8]">{servingsLeft}</span>{" "}
                            servings
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block rounded-full px-3 py-1 text-xs font-bold border ${
                                servingsLeft <= 0
                                  ? "bg-[#1A1814] text-[#E57373] border-[#E57373]/20"
                                  : servingsLeft <= 3
                                  ? "bg-[#1A1814] text-[#B8962E] border-[#B8962E]/20 animate-pulse"
                                  : "bg-[#1F1A0F] text-[#B8962E] border-[#B8962E]/20"
                              }`}
                            >
                              {servingsLeft <= 0
                                ? "Depleted"
                                : servingsLeft <= 3
                                ? "Low Servings"
                                : "Available"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {/* Dedicated Refill Action Button */}
                              <button
                                onClick={() => handleOpenRefill(product)}
                                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#1F1A0F] border border-[#B8962E]/30 text-[#B8962E] hover:bg-[#B8962E] hover:text-[#0E0D0B] text-xs font-bold transition shadow-sm cursor-pointer"
                                title="Refill Stock"
                              >
                                <PackagePlus size={14} />
                                <span>Refill</span>
                              </button>
                              <button
                                onClick={() => handleOpenEdit(product)}
                                className="grid size-9 place-items-center rounded-xl bg-[#131210] border border-[#2E2B24] text-[#B8962E] hover:bg-[#1F1A0F] hover:border-[#B8962E] transition cursor-pointer"
                                title="Edit Details"
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Main Modal: Add / Edit Details / Refill Stock */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => !submitting && setModalOpen(false)}
          />

          <div className="relative w-full max-w-lg rounded-3xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#A89F8C] z-10 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => !submitting && setModalOpen(false)}
              className="absolute top-4 right-4 text-[#A89F8C] hover:text-[#B8962E] transition cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* ------------------------------------------------------------- */}
            {/* VIEW A: DEDICATED REFILL STOCK MODAL                          */}
            {/* ------------------------------------------------------------- */}
            {modalMode === "refill" && editingProduct ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-2 rounded-xl bg-[#1F1A0F] border border-[#B8962E]/30 text-[#B8962E]">
                    <PackagePlus size={18} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#F5F0E8]">Refill Stock</h2>
                    <p className="text-xs text-[#A89F8C]">
                      Add new inventory without altering consumed servings history
                    </p>
                  </div>
                </div>

                {/* Read-only Current Product Info */}
                <div className="mt-4 rounded-2xl border border-[#2E2B24] bg-[#131210] p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-[#6B6358]">
                        Product Name
                      </p>
                      <h3 className="text-base font-bold text-[#F5F0E8] mt-0.5">
                        {editingProduct.name}
                      </h3>
                      {(editingProduct.brand || editingProduct.category) && (
                        <p className="text-xs text-[#6B6358]">
                          {[editingProduct.brand, editingProduct.category]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                        (editingProduct.noOfServings ?? 0) <= 0
                          ? "bg-[#1A1814] text-[#E57373] border-[#E57373]/20"
                          : "bg-[#1F1A0F] text-[#B8962E] border-[#B8962E]/20"
                      }`}
                    >
                      {(editingProduct.noOfServings ?? 0) <= 0 ? "Depleted" : "Active Stock"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#2E2B24]">
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-[#6B6358]">
                        Current Remaining
                      </p>
                      <p className="text-sm font-bold text-[#F5F0E8] mt-0.5">
                        {editingProduct.noOfServings ?? 0} servings
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-[#6B6358]">
                        Current Unit Cost
                      </p>
                      <p className="text-sm font-bold text-[#F5F0E8] mt-0.5">
                        {formatCurrency(activeUnitCost)} / serving
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleConfirmRefill} className="mt-5 space-y-4">
                  {/* Additional Servings Input */}
                  <label className="block">
                    <span className="text-sm font-semibold text-[#F5F0E8]">
                      Additional Servings to Add <span className="text-[#B8962E]">*</span>
                    </span>
                    <input
                      required
                      type="number"
                      min="1"
                      step="1"
                      value={refillData.additionalServings}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : Math.floor(Number(e.target.value));
                        const nextCost =
                          val !== "" && activeUnitCost > 0
                            ? Math.round(Number(val) * activeUnitCost)
                            : refillData.refillCost;
                        setRefillData({
                          ...refillData,
                          additionalServings: val,
                          refillCost: refillData.refillCost === "" ? nextCost : refillData.refillCost,
                        });
                      }}
                      placeholder="e.g. 10"
                      className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                    />
                    <p className="text-[11px] text-[#6B6358] mt-1">
                      Must be a positive whole number (e.g. 5, 10, 20).
                    </p>
                  </label>

                  {/* Refill Purchase Cost Input */}
                  <label className="block">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#F5F0E8]">
                        Refill Purchase Cost (₹) <span className="text-[#B8962E]">*</span>
                      </span>
                      {additionalServingsNum > 0 && activeUnitCost > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setRefillData({
                              ...refillData,
                              refillCost: Math.round(additionalServingsNum * activeUnitCost),
                            });
                          }}
                          className="text-[11px] text-[#B8962E] hover:underline cursor-pointer"
                        >
                          Fill at same unit cost (₹{Math.round(additionalServingsNum * activeUnitCost)})
                        </button>
                      )}
                    </div>
                    <input
                      required
                      type="number"
                      min="0"
                      step="any"
                      value={refillData.refillCost}
                      onChange={(e) => {
                        const val = e.target.value === "" ? "" : Number(e.target.value);
                        setRefillData({ ...refillData, refillCost: val });
                      }}
                      placeholder="e.g. 1000"
                      className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                    />
                    <p className="text-[11px] text-[#6B6358] mt-1">
                      Total amount paid for this new batch.
                    </p>
                  </label>

                  {/* Refill Notes (Optional) */}
                  <label className="block">
                    <span className="text-xs font-semibold text-[#A89F8C]">
                      Batch Note (Optional)
                    </span>
                    <input
                      type="text"
                      value={refillData.notes}
                      onChange={(e) =>
                        setRefillData({ ...refillData, notes: e.target.value })
                      }
                      placeholder="e.g. Invoice #203 / Vendor Batch 12"
                      className="mt-1.5 h-10 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-3 text-xs text-[#F5F0E8] outline-none focus:border-[#B8962E]"
                    />
                  </label>

                  {/* Live Cost & Stock Preview */}
                  {refillPreview && (
                    <div className="rounded-2xl border border-[#B8962E]/30 bg-[#1F1A0F]/60 p-4 space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#F5F0E8]">
                        <CheckCircle2 size={15} className="text-[#B8962E]" />
                        <span>Stock & Cost Preview</span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl bg-[#131210] p-2.5 border border-[#2E2B24]">
                          <span className="text-[#6B6358] block">Previous Stock</span>
                          <span className="font-bold text-[#F5F0E8]">
                            {currentRemainingServings} servings
                          </span>
                        </div>
                        <div className="rounded-xl bg-[#131210] p-2.5 border border-[#2E2B24]">
                          <span className="text-[#6B6358] block">Added Stock</span>
                          <span className="font-bold text-[#B8962E]">
                            +{additionalServingsNum} servings
                          </span>
                        </div>
                        <div className="rounded-xl bg-[#131210] p-2.5 border border-[#2E2B24]">
                          <span className="text-[#6B6358] block">New Available Total</span>
                          <span className="font-bold text-[#F5F0E8] text-sm">
                            {refillPreview.newRemainingServings} servings
                          </span>
                        </div>
                        <div className="rounded-xl bg-[#131210] p-2.5 border border-[#2E2B24]">
                          <span className="text-[#6B6358] block">Refill Batch Unit Cost</span>
                          <span className="font-bold text-[#F5F0E8] text-sm">
                            {formatCurrency(refillPreview.refillUnitCost)} / serving
                          </span>
                        </div>
                      </div>

                      {/* Costing Rule Banner */}
                      <div className="rounded-xl bg-[#131210] p-3 border border-[#2E2B24] text-[11px] leading-relaxed">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-[#F5F0E8]">
                            Active Unit Cost After Refill:
                          </span>
                          <span className="text-sm font-extrabold text-[#B8962E]">
                            {formatCurrency(refillPreview.newCostPerServing)} / serving
                          </span>
                        </div>
                        {refillPreview.isSameUnitCost ? (
                          <p className="text-[#A89F8C]">
                            <strong className="text-[#B8962E]">Case A: Same Unit Cost.</strong>{" "}
                            Unit cost remains unchanged at {formatCurrency(refillPreview.newCostPerServing)} per serving.
                          </p>
                        ) : currentRemainingServings <= 0 ? (
                          <p className="text-[#A89F8C]">
                            <strong className="text-[#B8962E]">Depleted Stock Refill.</strong>{" "}
                            Previous inventory was depleted. Active unit cost is set to the new batch cost of {formatCurrency(refillPreview.newCostPerServing)} per serving.
                          </p>
                        ) : (
                          <p className="text-[#A89F8C]">
                            <strong className="text-[#B8962E]">Case B: Weighted-Average Costing.</strong>{" "}
                            Computed as: ({currentRemainingServings} × {formatCurrency(activeUnitCost)} + {additionalServingsNum} × {formatCurrency(refillPreview.refillUnitCost)}) / {refillPreview.newRemainingServings} = <strong>{formatCurrency(refillPreview.newCostPerServing)}</strong> per serving.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Refill History Accordion (if available) */}
                  {editingProduct.refillHistory && editingProduct.refillHistory.length > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowRefillHistory(!showRefillHistory)}
                        className="flex items-center gap-2 text-xs font-semibold text-[#A89F8C] hover:text-[#B8962E] transition cursor-pointer"
                      >
                        <History size={14} />
                        <span>
                          {showRefillHistory ? "Hide" : "View"} Refill History (
                          {editingProduct.refillHistory.length})
                        </span>
                      </button>

                      {showRefillHistory && (
                        <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-[#2E2B24] bg-[#0E0D0B] p-2 space-y-1.5 text-[11px]">
                          {editingProduct.refillHistory
                            .slice()
                            .reverse()
                            .map((h, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 rounded-lg bg-[#131210] border border-[#2E2B24]/50"
                              >
                                <div>
                                  <span className="font-bold text-[#F5F0E8]">
                                    +{h.servingsAdded} servings
                                  </span>{" "}
                                  <span className="text-[#6B6358]">
                                    ({formatCurrency(h.cost)})
                                  </span>
                                  {h.notes && (
                                    <span className="text-stone-400 block text-[10px]">
                                      Note: {h.notes}
                                    </span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className="text-[#B8962E] font-semibold">
                                    {formatCurrency(h.newCostPerServing)}/srv
                                  </span>
                                  <span className="text-[#6B6358] block text-[10px]">
                                    {new Date(h.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Modal Action Buttons */}
                  <div className="flex gap-3 justify-end pt-3 border-t border-[#2E2B24]">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setModalMode("edit")}
                      className="h-11 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] transition cursor-pointer disabled:opacity-50"
                    >
                      Back to Details
                    </button>
                    <button
                      type="submit"
                      disabled={
                        submitting ||
                        !additionalServingsNum ||
                        additionalServingsNum <= 0 ||
                        isNaN(refillCostNum) ||
                        refillCostNum < 0
                      }
                      className="inline-flex items-center gap-2 h-11 rounded-xl bg-[#B8962E] px-6 text-sm font-bold text-[#0E0D0B] hover:bg-[#D4A935] shadow-[0_4px_16px_rgba(184,150,46,0.25)] transition disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <div className="size-4 animate-spin rounded-full border-2 border-[#0E0D0B] border-t-transparent" />
                          <span>Refilling Stock...</span>
                        </>
                      ) : (
                        <>
                          <PackagePlus size={16} />
                          <span>Confirm Refill</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* ------------------------------------------------------------- */
              /* VIEW B: ADD PRODUCT / EDIT PRODUCT DETAILS                    */
              /* ------------------------------------------------------------- */
              <div>
                <h2 className="text-xl font-bold text-[#F5F0E8] mb-1">
                  {editingProduct
                    ? "Edit Details"
                    : formData.type === "retail"
                    ? "Add Retail Product"
                    : "Add Service Supply"}
                </h2>
                <p className="text-xs text-[#A89F8C] mb-4">
                  {editingProduct
                    ? "Update product metadata. Stock is refilled separately."
                    : formData.type === "retail"
                    ? "Register a retail product sold to customers."
                    : "Register supplies consumed during service treatments."}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-semibold text-[#A89F8C]">Name</span>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E] placeholder-[#6B6358]"
                      placeholder={
                        formData.type === "retail"
                          ? "e.g. Keratin Repair Serum"
                          : "e.g. Hair Straightening Cream / Color Tube"
                      }
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-[#A89F8C]">Brand</span>
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E] placeholder-[#6B6358]"
                      placeholder="e.g. L'Oreal, Wella, Schwarzkopf"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-[#A89F8C]">Category</span>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E] placeholder-[#6B6358]"
                      placeholder="e.g. Hair Treatments, Facial Supplies, Color"
                    />
                  </label>

                  {formData.type === "retail" ? (
                    <>
                      <label className="block">
                        <span className="text-sm font-semibold text-[#A89F8C]">
                          Retail Price (₹)
                        </span>
                        <input
                          required
                          type="number"
                          min="0"
                          value={formData.price === 0 ? "" : formData.price}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              price: e.target.value === "" ? 0 : Number(e.target.value),
                            })
                          }
                          className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-[#A89F8C]">
                          In-Stock Quantity
                        </span>
                        <input
                          required
                          type="number"
                          min="0"
                          value={formData.quantity === 0 ? "" : formData.quantity}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              quantity:
                                e.target.value === "" ? 0 : Number(e.target.value),
                            })
                          }
                          className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                        />
                      </label>
                    </>
                  ) : editingProduct ? (
                    /* ------------------------------------------------------- */
                    /* EDIT MODE FOR SERVICE PRODUCT                           */
                    /* Separates editable details from stock & purchase info   */
                    /* ------------------------------------------------------- */
                    <div className="space-y-4 pt-2">
                      {/* Current Stock and Unit Cost Card */}
                      <div className="rounded-2xl border border-[#2E2B24] bg-[#131210] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#F5F0E8] uppercase tracking-wider">
                            Current Stock & Cost
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                              (editingProduct.noOfServings ?? 0) <= 0
                                ? "bg-[#1A1814] text-[#E57373] border-[#E57373]/20"
                                : "bg-[#1F1A0F] text-[#B8962E] border-[#B8962E]/20"
                            }`}
                          >
                            {(editingProduct.noOfServings ?? 0) <= 0
                              ? "Depleted"
                              : `${editingProduct.noOfServings} Available`}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-[#0E0D0B] p-3 border border-[#2E2B24]">
                            <span className="text-[11px] text-[#6B6358] block">
                              Remaining Servings
                            </span>
                            <span className="text-base font-extrabold text-[#F5F0E8]">
                              {editingProduct.noOfServings ?? 0} servings
                            </span>
                          </div>
                          <div className="rounded-xl bg-[#0E0D0B] p-3 border border-[#2E2B24]">
                            <span className="text-[11px] text-[#6B6358] block">
                              Cost Per Serving
                            </span>
                            <span className="text-base font-extrabold text-[#B8962E]">
                              {formatCurrency(getEffectiveCostPerServing(editingProduct))}
                            </span>
                          </div>
                        </div>

                        {/* Dedicated Refill Button */}
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => handleOpenRefill(editingProduct)}
                            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F1A0F] border border-[#B8962E]/40 px-4 text-xs font-bold text-[#B8962E] hover:bg-[#B8962E] hover:text-[#0E0D0B] shadow-sm transition duration-150 cursor-pointer"
                          >
                            <PackagePlus size={16} />
                            <span>Refill Stock (Add Servings)</span>
                          </button>
                          <p className="text-[10px] text-center text-[#6B6358] mt-1.5">
                            Add stock without resetting past consumption or recalculating historical cost.
                          </p>
                        </div>
                      </div>

                      {/* Read-Only Original Purchase Information */}
                      <div className="rounded-2xl border border-[#2E2B24]/70 bg-[#0E0D0B] p-4 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#A89F8C]">
                          <Info size={14} className="text-[#6B6358]" />
                          <span>Original Purchase Information (Read-Only)</span>
                        </div>
                        <p className="text-[11px] text-[#6B6358]">
                          Initial values recorded when this product was first created.
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div className="text-[#A89F8C]">
                            Purchase Cost:{" "}
                            <strong className="text-[#F5F0E8]">
                              {formatCurrency(editingProduct.amount || 0)}
                            </strong>
                          </div>
                          <div className="text-[#A89F8C]">
                            Original Servings:{" "}
                            <strong className="text-[#F5F0E8]">
                              {resolveProductOriginalServings(editingProduct)} servings
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* ------------------------------------------------------- */
                    /* CREATE MODE FOR NEW SERVICE SUPPLY                      */
                    /* ------------------------------------------------------- */
                    <>
                      <label className="block">
                        <span className="text-sm font-semibold text-[#A89F8C]">
                          Total Purchase Cost (₹)
                        </span>
                        <input
                          required
                          type="number"
                          min="1"
                          step="any"
                          value={formData.amount === 0 ? "" : formData.amount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              amount:
                                e.target.value === "" ? 0 : Number(e.target.value),
                            })
                          }
                          className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                          placeholder="e.g. 1000"
                        />
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-[#A89F8C]">
                          Original Purchased Servings
                        </span>
                        <input
                          required
                          type="number"
                          min="1"
                          step="1"
                          value={
                            formData.originalServings === 0
                              ? ""
                              : formData.originalServings
                          }
                          onChange={(e) => {
                            const val =
                              e.target.value === ""
                                ? 0
                                : Math.floor(Number(e.target.value));
                            setFormData({ ...formData, originalServings: val });
                          }}
                          className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                          placeholder="e.g. 10"
                        />
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-[#A89F8C]">
                          Cost Per Serving (Auto-calculated)
                        </span>
                        <input
                          readOnly
                          type="text"
                          value={
                            formData.originalServings > 0 && formData.amount > 0
                              ? `${formatCurrency(
                                  computeCostPerServing(
                                    formData.amount,
                                    formData.originalServings
                                  )
                                )} / serving`
                              : "—"
                          }
                          className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#A89F8C] outline-none cursor-not-allowed"
                        />
                        <p className="text-[11px] text-[#6B6358] mt-1">
                          Calculated as Total Cost ÷ Original Servings. Stored immutably.
                        </p>
                      </label>
                    </>
                  )}

                  <div className="flex gap-3 justify-end pt-3 border-t border-[#2E2B24]">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setModalOpen(false)}
                      className="h-11 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] transition cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="h-11 rounded-xl bg-[#B8962E] px-6 text-sm font-bold text-[#0E0D0B] hover:bg-[#D4A935] shadow-[0_4px_16px_rgba(184,150,46,0.25)] transition disabled:opacity-50 cursor-pointer"
                    >
                      {submitting
                        ? "Saving..."
                        : editingProduct
                        ? "Save Details"
                        : "Create Product"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDeleteConfirmOpen(false)}
          />
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