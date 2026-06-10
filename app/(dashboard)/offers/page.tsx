"use client";

import { useEffect, useState } from "react";
import * as offersService from "@/services/offers";
import type { Offer } from "@/types/offer";
import { Plus, Search, Edit2, Trash2, X, Tag } from "lucide-react";
import { formatCurrency } from "@/components/salon-dashboard/types";

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    discountType: "percentage",
    discountValue: 10,
    status: "Active",
  });

  const loadOffers = async () => {
    setLoading(true);
    try {
      const data = await offersService.getAll();
      setOffers(data);
    } catch (error) {
      console.error("Failed to load offers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOffers();
  }, []);

  const handleOpenAdd = () => {
    setEditingOffer(null);
    setFormData({
      code: "",
      name: "",
      discountType: "percentage",
      discountValue: 10,
      status: "Active",
    });
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
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this offer campaign?")) return;
    try {
      await offersService.delete(id);
      loadOffers();
    } catch (error) {
      console.error("Failed to delete offer:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingOffer?.id) {
        await offersService.update(editingOffer.id, formData);
      } else {
        await offersService.create(formData);
      }
      setModalOpen(false);
      loadOffers();
    } catch (error) {
      console.error("Failed to save offer:", error);
    }
  };

  const filteredOffers = offers.filter(
    (o) =>
      o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        // Empty State UI
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
            <table className="w-full min-w-[800px] border-collapse text-left text-sm text-stone-600">
              <thead className="bg-stone-55 text-xs uppercase tracking-[0.2em] text-stone-555 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-4 font-bold">Promo Code</th>
                  <th className="px-6 py-4 font-bold">Campaign Name</th>
                  <th className="px-6 py-4 font-bold">Discount</th>
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
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                          offer.status === "Active"
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
          <div className="relative w-full max-w-md rounded-2xl border border-stone-250 bg-white p-6 shadow-2xl text-stone-900">
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
