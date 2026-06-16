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
  customerType: "all" | "regular" | "membership";
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
  customerType: "all",
};

export default function OffersPage() {
  const { offers, services, products, refreshOffers, loadingAppData } = useAppData();
  const servicesList = services;
  const productsList = products.filter((p) => !p.type || p.type === "retail");
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
      customerType: o.customerType || "all",
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
        customerType: formData.customerType,
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
    if (o.customerType && o.customerType !== "all") {
      parts.push(`Target: ${o.customerType === "membership" ? "Membership Only" : "Regular Only"}`);
    }
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
    <div className="w-full text-[#F5F0E8]">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A89F8C]">
          Marketing
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#F5F0E8]">
          Offers & Promotions
        </h1>
      </div>
      {!loading && offers.length > 0 && (
        <button
          onClick={handleOpenAdd}
          className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#B8962E] px-6 text-sm font-bold text-[#0E0D0B] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#D4A935]"
        >
          <Plus size={18} />
          Add Offer
        </button>
      )}
    </div>

    {loading ? (
      <div className="flex h-[40vh] items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-4 border-[#B8962E] border-t-transparent" />
      </div>
    ) : offers.length === 0 ? (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-12 text-center shadow-md">
        <div className="grid size-16 place-items-center rounded-2xl bg-[#131210] text-[#B8962E] mb-4">
          <Tag size={32} />
        </div>
        <h2 className="text-xl font-bold text-[#F5F0E8]">No Offers Found</h2>
        <p className="mt-2 max-w-sm text-sm text-[#A89F8C]">
          Publish coupon discounts, seasonal promotions, and campaigns to boost salon billing volume.
        </p>
        <button
          onClick={handleOpenAdd}
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-[#B8962E] px-6 text-sm font-bold text-[#0E0D0B] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#D4A935]"
        >
          <Plus size={18} />
          Add Offer
        </button>
      </div>
    ) : (
      <>
        {/* Search bar */}
        <div className="mb-4 flex max-w-md items-center rounded-2xl border border-[#2E2B24] bg-[#131210] px-4 h-12 shadow-sm focus-within:border-[#B8962E]">
          <Search size={18} className="text-[#6B6358] mr-2" />
          <input
            type="text"
            placeholder="Search coupon codes or names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-[#F5F0E8] outline-none placeholder:text-[#6B6358]"
          />
        </div>

        {/* List display */}
        <div className="overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#1C1A16] shadow-md">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm text-[#A89F8C]">
            <thead className="bg-[#131210] text-xs uppercase tracking-[0.2em] text-[#A89F8C] border-b border-[#2E2B24]">
              <tr>
                <th className="px-6 py-4 font-bold">Promo Code</th>
                <th className="px-6 py-4 font-bold">Campaign Name</th>
                <th className="px-6 py-4 font-bold">Discount</th>
                <th className="px-6 py-4 font-bold">Rules</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2E2B24]">
              {filteredOffers.map((offer) => (
                <tr key={offer.id} className="hover:bg-[#1F1A0F] transition bg-[#1C1A16] text-[#F5F0E8]">
                  <td className="px-6 py-4 font-bold text-[#B8962E] uppercase tracking-wider">{offer.code}</td>
                  <td className="px-6 py-4 font-semibold">{offer.name}</td>
                  <td className="px-6 py-4 font-medium text-[#F5F0E8]">
                    {offer.discountType === "percentage"
                      ? `${offer.discountValue}% Off`
                      : `${formatCurrency(offer.discountValue)} Off`}
                  </td>
                  <td className="px-6 py-4 text-xs text-[#A89F8C] max-w-[260px]">
                    {describeOffer(offer)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${offer.status === "Active"
                        ? "bg-[#0C2E1D] text-[#34D399] border border-[#105E3C]"
                        : "bg-[#131210] text-[#A89F8C] border border-[#2E2B24]"
                        }`}
                    >
                      {offer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(offer)}
                        className="grid size-10 place-items-center rounded-xl bg-[#131210] border border-[#2E2B24] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] transition animate-fade-in"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => offer.id && handleDelete(offer.id)}
                        className="grid size-10 place-items-center rounded-xl bg-[#2E1616] border border-[#5C2424] text-[#E57373] hover:bg-[#471C1C] transition"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
        <div className="relative w-full max-w-lg rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#F5F0E8] max-h-[90vh] overflow-y-auto">
          <button
            onClick={() => setModalOpen(false)}
            className="absolute top-4 right-4 text-[#A89F8C] hover:text-[#F5F0E8]"
          >
            <X size={20} />
          </button>
          <h2 className="text-xl font-bold text-[#F5F0E8] mb-4">
            {editingOffer ? "Edit Offer Campaign" : "Launch Discount Campaign"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-[#A89F8C]">Coupon Code</span>
              <input
                required
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm font-bold text-[#F5F0E8] uppercase outline-none transition focus:border-[#B8962E]"
                placeholder="e.g. SUMMER20"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[#A89F8C]">Campaign Name</span>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm text-[#F5F0E8] outline-none transition focus:border-[#B8962E]"
                placeholder="e.g. 20% Summer Hair Styling discount"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Discount Type</span>
                <select
                  value={formData.discountType}
                  onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm text-[#F5F0E8] outline-none transition focus:border-[#B8962E]"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat Cash (INR)</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Discount Value</span>
                <input
                  required
                  type="number"
                  min="1"
                  value={formData.discountValue === 0 ? "" : formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value === "" ? 0 : Number(e.target.value) })}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm text-[#F5F0E8] outline-none transition focus:border-[#B8962E]"
                />
              </label>
            </div>

            {/* Validity dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Valid From</span>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm text-[#F5F0E8] outline-none transition focus:border-[#B8962E]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Valid Until</span>
                <input
                  type="date"
                  value={formData.endDate}
                  min={formData.startDate || undefined}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm text-[#F5F0E8] outline-none transition focus:border-[#B8962E]"
                />
              </label>
            </div>
            <p className="text-xs text-[#6B6358] -mt-2">Leave dates blank for an offer with no expiration.</p>

            {/* Minimum bill amount */}
            <label className="block">
              <span className="text-sm font-semibold text-[#A89F8C]">Minimum Bill Amount (INR)</span>
              <input
                type="number"
                min="0"
                value={formData.minBillAmount === 0 ? "" : formData.minBillAmount}
                onChange={(e) => setFormData({ ...formData, minBillAmount: e.target.value === "" ? 0 : Number(e.target.value) })}
                className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm text-[#F5F0E8] outline-none transition focus:border-[#B8962E]"
                placeholder="0 = no minimum"
              />
            </label>

            {/* Applicable services */}
            <div className="block">
              <span className="text-sm font-semibold text-[#A89F8C]">Applicable Services</span>
              <p className="text-xs text-[#6B6358] mb-2">Leave all unchecked to apply this offer to the whole bill.</p>
              <div className="max-h-32 overflow-y-auto rounded-xl border border-[#2E2B24] bg-[#131210] p-2 space-y-1">
                {servicesList.length === 0 ? (
                  <p className="text-xs text-[#6B6358] px-2 py-1">No services available.</p>
                ) : (
                  servicesList.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#1C1A16] cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={!!s.id && formData.applicableServiceIds.includes(s.id)}
                        onChange={() => s.id && toggleServiceId(s.id)}
                        className="size-4 accent-[#B8962E]"
                      />
                      <span className="text-[#F5F0E8]">{s.name}</span>
                      <span className="text-[#A89F8C] text-xs ml-auto">{formatCurrency(s.price)}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Applicable products */}
            <div className="block">
              <span className="text-sm font-semibold text-[#A89F8C]">Applicable Products</span>
              <p className="text-xs text-[#6B6358] mb-2">Leave all unchecked to apply this offer to the whole bill.</p>
              <div className="max-h-32 overflow-y-auto rounded-xl border border-[#2E2B24] bg-[#131210] p-2 space-y-1">
                {productsList.length === 0 ? (
                  <p className="text-xs text-[#6B6358] px-2 py-1">No products available.</p>
                ) : (
                  productsList.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#1C1A16] cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={!!p.id && formData.applicableProductIds.includes(p.id)}
                        onChange={() => p.id && toggleProductId(p.id)}
                        className="size-4 accent-[#B8962E]"
                      />
                      <span className="text-[#F5F0E8]">{p.name}</span>
                      <span className="text-[#A89F8C] text-xs ml-auto">{formatCurrency(p.price)}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-[#A89F8C]">Target Customer Type</span>
              <select
                value={formData.customerType}
                onChange={(e) => setFormData({ ...formData, customerType: e.target.value as "all" | "regular" | "membership" })}
                className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm text-[#F5F0E8] outline-none transition focus:border-[#B8962E]"
              >
                <option value="all">All Customers</option>
                <option value="regular">Regular Customers Only</option>
                <option value="membership">Membership Customers Only</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-[#A89F8C]">Campaign Status</span>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm text-[#F5F0E8] outline-none transition focus:border-[#B8962E]"
              >
                <option value="Active">Active Campaign</option>
                <option value="Inactive">Paused / Inactive</option>
              </select>
            </label>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-11 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm font-semibold text-[#A89F8C] hover:bg-[#1C1A16] hover:text-[#F5F0E8] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-11 rounded-xl bg-[#B8962E] px-6 text-sm font-bold text-[#0E0D0B] hover:bg-[#D4A935] transition"
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