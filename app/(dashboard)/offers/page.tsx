"use client";

import { useState } from "react";
import * as offersService from "@/services/offers";
import { useAppData } from "@/context/AppDataContext";
import type { Offer } from "@/types/offer";
import type { Service } from "@/types/service";
import type { Product } from "@/types/product";
import { Plus, Search, Edit2, Trash2, X, Tag } from "lucide-react";
import { formatCurrency } from "@/components/salon-dashboard/types";

type OfferFormData = {
  code: string;
  name: string;
  discountType: string;
  discountValue: number;
  status: string;
  startDate: string;
  endDate: string;
  minBillAmount: number;
  applicableServiceIds: string[];
  applicableProductIds: string[];
};

const emptyForm: OfferFormData = {
  code: "",
  name: "",
  discountType: "percentage",
  discountValue: 10,
  status: "Active",
  startDate: "",
  endDate: "",
  minBillAmount: 0,
  applicableServiceIds: [],
  applicableProductIds: [],
};

export default function OffersPage() {
  const { offers, services, products, refreshOffers, loadingAppData } = useAppData();
  const servicesList = services;
  const productsList = products;
  const loading = loadingAppData;

  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [formData, setFormData] = useState<OfferFormData>(emptyForm);

  const handleOpenAdd = () => {
    setEditingOffer(null);
    setFormData(emptyForm);
    setModalOpen(true);
  };

  const handleOpenEdit = (o: Offer) => {
    setEditingOffer(o);
    setFormData({
      code: o.code,
      name: o.name,
      discountType: o.discountType || "percentage",
      discountValue: o.discountValue,
      status: o.status || "Active",
      startDate: o.startDate || "",
      endDate: o.endDate || "",
      minBillAmount: o.minBillAmount || 0,
      applicableServiceIds: o.applicableServiceIds || [],
      applicableProductIds: o.applicableProductIds || [],
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this offer campaign?")) return;
    try {
      await offersService.delete(id);
      await refreshOffers();
    } catch (error) {
      console.error("Failed to delete offer:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        code: formData.code,
        name: formData.name,
        discountType: formData.discountType,
        discountValue: formData.discountValue,
        status: formData.status,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        minBillAmount: formData.minBillAmount || 0,
        applicableServiceIds: formData.applicableServiceIds,
        applicableProductIds: formData.applicableProductIds,
      };
      if (editingOffer?.id) {
        await offersService.update(editingOffer.id, payload);
      } else {
        await offersService.create(payload as Omit<Offer, "id">);
      }
      setModalOpen(false);
      await refreshOffers();
    } catch (error) {
      console.error("Failed to save offer:", error);
    }
  };

  const toggleServiceId = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      applicableServiceIds: prev.applicableServiceIds.includes(id)
        ? prev.applicableServiceIds.filter((x) => x !== id)
        : [...prev.applicableServiceIds, id],
    }));
  };

  const toggleProductId = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      applicableProductIds: prev.applicableProductIds.includes(id)
        ? prev.applicableProductIds.filter((x) => x !== id)
        : [...prev.applicableProductIds, id],
    }));
  };

  const filteredOffers = offers.filter(
    (o) =>
      o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper to describe an offer's applicability/validity inline in the list
  const describeOffer = (o: Offer) => {
    const parts: string[] = [];
    if (o.startDate || o.endDate) {
      parts.push(`Valid ${o.startDate || "anytime"} → ${o.endDate || "no end"}`);
    }
    if (o.minBillAmount) {
      parts.push(`Min bill ${formatCurrency(o.minBillAmount)}`);
    }
    const svcCount = o.applicableServiceIds?.length || 0;
    const prodCount = o.applicableProductIds?.length || 0;
    if (svcCount || prodCount) {
      const bits: string[] = [];
      if (svcCount) bits.push(`${svcCount} service${svcCount > 1 ? "s" : ""}`);
      if (prodCount) bits.push(`${prodCount} product${prodCount > 1 ? "s" : ""}`);
      parts.push(`Applies to ${bits.join(", ")}`);
    } else {
      parts.push("Applies to whole bill");
    }
    return parts.join(" · ");
  };

  return (
    <div className="w-full text-stone-900">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-stone-500">
            Marketing
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            Offers & Promotions
          </h1>
        </div>
        {!loading && offers.length > 0 && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-850"
          >
            <Plus size={18} />
            Add Offer
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
        </div>
      ) : offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-md">
          <div className="grid size-16 place-items-center rounded-2xl bg-stone-100 text-stone-900 mb-4">
            <Tag size={32} />
          </div>
          <h2 className="text-xl font-bold text-stone-900">No Offers Found</h2>
          <p className="mt-2 max-w-sm text-sm text-stone-500">
            Publish coupon discounts, seasonal promotions, and campaigns to boost salon billing volume.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-850"
          >
            <Plus size={18} />
            Add Offer
          </button>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="mb-4 flex max-w-md items-center rounded-2xl border border-stone-200 bg-white px-4 h-12 shadow-sm focus-within:border-black">
            <Search size={18} className="text-stone-400 mr-2" />
            <input
              type="text"
              placeholder="Search coupon codes or names..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
            />
          </div>

          {/* List display */}
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-md">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm text-stone-600">
              <thead className="bg-stone-55 text-xs uppercase tracking-[0.2em] text-stone-555 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-4 font-bold">Promo Code</th>
                  <th className="px-6 py-4 font-bold">Campaign Name</th>
                  <th className="px-6 py-4 font-bold">Discount</th>
                  <th className="px-6 py-4 font-bold">Rules</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredOffers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-stone-50 transition bg-white text-stone-900">
                    <td className="px-6 py-4 font-bold text-stone-900 uppercase tracking-wider">{offer.code}</td>
                    <td className="px-6 py-4 font-semibold">{offer.name}</td>
                    <td className="px-6 py-4 font-medium">
                      {offer.discountType === "percentage"
                        ? `${offer.discountValue}% Off`
                        : `${formatCurrency(offer.discountValue)} Off`}
                    </td>
                    <td className="px-6 py-4 text-xs text-stone-500 max-w-[260px]">
                      {describeOffer(offer)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${offer.status === "Active"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-stone-100 text-stone-800 border border-stone-300"
                          }`}
                      >
                        {offer.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(offer)}
                          className="grid size-10 place-items-center rounded-xl border border-stone-200 text-stone-400 hover:text-black hover:border-black transition"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => offer.id && handleDelete(offer.id)}
                          className="grid size-10 place-items-center rounded-xl border border-stone-200 text-stone-400 hover:text-red-650 hover:border-red-500 hover:bg-red-50 transition"
                          title="Delete"
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

      {/* Modal Overlay Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-stone-250 bg-white p-6 shadow-2xl text-stone-900 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-black"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-stone-900 mb-4">
              {editingOffer ? "Edit Offer Campaign" : "Launch Discount Campaign"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Coupon Code</span>
                <input
                  required
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm font-bold text-stone-900 uppercase outline-none transition focus:border-black"
                  placeholder="e.g. SUMMER20"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Campaign Name</span>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  placeholder="e.g. 20% Summer Hair Styling discount"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Discount Type</span>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                    className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Cash (INR)</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Discount Value</span>
                  <input
                    required
                    type="number"
                    min="1"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                    className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  />
                </label>
              </div>

              {/* Validity dates */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Valid From</span>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Valid Until</span>
                  <input
                    type="date"
                    value={formData.endDate}
                    min={formData.startDate || undefined}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  />
                </label>
              </div>
              <p className="text-xs text-stone-400 -mt-2">Leave dates blank for an offer with no expiration.</p>

              {/* Minimum bill amount */}
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Minimum Bill Amount (INR)</span>
                <input
                  type="number"
                  min="0"
                  value={formData.minBillAmount}
                  onChange={(e) => setFormData({ ...formData, minBillAmount: Number(e.target.value) })}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  placeholder="0 = no minimum"
                />
              </label>

              {/* Applicable services */}
              <div className="block">
                <span className="text-sm font-semibold text-stone-700">Applicable Services</span>
                <p className="text-xs text-stone-400 mb-2">Leave all unchecked to apply this offer to the whole bill.</p>
                <div className="max-h-32 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-2 space-y-1">
                  {servicesList.length === 0 ? (
                    <p className="text-xs text-stone-400 px-2 py-1">No services available.</p>
                  ) : (
                    servicesList.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={!!s.id && formData.applicableServiceIds.includes(s.id)}
                          onChange={() => s.id && toggleServiceId(s.id)}
                          className="size-4 accent-black"
                        />
                        <span className="text-stone-800">{s.name}</span>
                        <span className="text-stone-400 text-xs ml-auto">{formatCurrency(s.price)}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Applicable products */}
              <div className="block">
                <span className="text-sm font-semibold text-stone-700">Applicable Products</span>
                <p className="text-xs text-stone-400 mb-2">Leave all unchecked to apply this offer to the whole bill.</p>
                <div className="max-h-32 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-2 space-y-1">
                  {productsList.length === 0 ? (
                    <p className="text-xs text-stone-400 px-2 py-1">No products available.</p>
                  ) : (
                    productsList.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={!!p.id && formData.applicableProductIds.includes(p.id)}
                          onChange={() => p.id && toggleProductId(p.id)}
                          className="size-4 accent-black"
                        />
                        <span className="text-stone-800">{p.name}</span>
                        <span className="text-stone-400 text-xs ml-auto">{formatCurrency(p.price)}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Campaign Status</span>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                >
                  <option value="Active">Active Campaign</option>
                  <option value="Inactive">Paused / Inactive</option>
                </select>
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
                  Save Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}