"use client";

import { useState } from "react";
import * as servicesService from "@/services/services";
import { useAppData } from "@/context/AppDataContext";
import type { Service } from "@/types/service";
import { Plus, Search, Edit2, Trash2, X, Scissors } from "lucide-react";
import { formatCurrency } from "@/components/salon-dashboard/types";

export default function ServicesPage() {
  const { services, refreshServices, loadingAppData } = useAppData();
  const loading = loadingAppData;
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    price: 0,
    category: "Hair",
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingService(null);
    setFormData({
      name: "",
      price: 0,
      category: "Hair",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      price: service.price,
      category: service.category || "Hair",
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
      await servicesService.delete(idToDelete);
      setDeleteConfirmOpen(false);
      setIdToDelete(null);
      await refreshServices();
    } catch (error) {
      console.error("Failed to delete service:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingService?.id) {
        await servicesService.update(editingService.id, formData);
      } else {
        await servicesService.create(formData);
      }
      setModalOpen(false);
      await refreshServices();
    } catch (error) {
      console.error("Failed to save service:", error);
    }
  };

  const filteredServices = services.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full text-[#A89F8C]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">
            Catalog
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#F5F0E8]">
            Services
          </h1>
        </div>
        {!loading && services.length > 0 && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] px-6 text-sm font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] shadow-sm transition duration-150 cursor-pointer"
          >
            <Plus size={18} />
            Add Service
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-[#B8962E] border-t-transparent" />
        </div>
      ) : services.length === 0 ? (
        // Empty State UI
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#2E2B24] bg-[#131210] p-12 text-center shadow-md">
          <div className="grid size-16 place-items-center rounded-2xl bg-[#0E0D0B] text-[#B8962E] border border-[#2E2B24] mb-4">
            <Scissors size={32} />
          </div>
          <h2 className="text-xl font-bold text-[#F5F0E8]">No Services Found</h2>
          <p className="mt-2 max-w-sm text-sm text-[#A89F8C]">
            Define your service menu catalog so you can invoice clients and book appointments.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] px-6 text-sm font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] shadow-sm transition duration-150 cursor-pointer"
          >
            <Plus size={18} />
            Add Service
          </button>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="mb-4 flex max-w-md items-center rounded-xl border border-[#2E2B24] bg-[#131210] px-4 h-12 shadow-sm focus-within:border-[#B8962E] transition">
            <Search size={18} className="text-[#6B6358] mr-2" />
            <input
              type="text"
              placeholder="Search services or categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-[#F5F0E8] outline-none placeholder:text-[#6B6358]"
            />
          </div>

          {/* List display */}
          <div className="overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#131210] shadow-md">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm text-[#A89F8C]">
              <thead className="bg-[#0E0D0B] text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C] border-b border-[#2E2B24]">
                <tr>
                  <th className="px-6 py-4 font-bold">Service Name</th>
                  <th className="px-6 py-4 font-bold">Category</th>
                  <th className="px-6 py-4 font-bold">Price</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E2B24]">
                {filteredServices.map((service) => (
                  <tr key={service.id} className="hover:bg-[#1C1A16] transition bg-transparent text-[#A89F8C]">
                    <td className="px-6 py-4 font-semibold text-[#F5F0E8]">{service.name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block rounded-full bg-[#0E0D0B] border border-[#2E2B24] px-3 py-1 text-xs text-[#A89F8C]">
                        {service.category || "Hair"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-[#B8962E]">{formatCurrency(service.price)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(service)}
                          className="grid size-10 place-items-center rounded-xl bg-[#131210] border border-[#2E2B24] text-[#B8962E] hover:bg-[#1F1A0F] hover:border-[#B8962E] transition cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => service.id && handleDeleteTrigger(service.id)}
                          className="grid size-10 place-items-center rounded-xl bg-[#131210] border border-[#2E2B24] text-[#E57373] hover:bg-[#131210] hover:border-[#E57373] transition cursor-pointer"
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
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#A89F8C] animate-in zoom-in-95 duration-200 z-10">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-[#A89F8C] hover:text-[#B8962E] transition cursor-pointer"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-[#F5F0E8] mb-4">
              {editingService ? "Edit Service Detail" : "Add Service"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Service Name</span>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E] placeholder-[#6B6358]"
                  placeholder="e.g. Luxury Hair Spa"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Category</span>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                >
                  <option value="Hair">Hair Care</option>
                  <option value="Skin">Skin Rituals</option>
                  <option value="Nails">Nails Spa</option>
                  <option value="Bridal">Bridal Makeups</option>
                  <option value="Massage">Massage Therapy</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Price (INR)</span>
                <input
                  required
                  type="number"
                  min="0"
                  value={formData.price === 0 ? "" : formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value === "" ? 0 : Number(e.target.value) })}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                />
              </label>

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
                  Save Service
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
            <h3 className="text-lg font-bold text-[#F5F0E8]">Are you sure you want to delete this record?</h3>
            <p className="mt-2 text-sm text-[#A89F8C]">This action cannot be undone and will remove the record immediately.</p>
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
