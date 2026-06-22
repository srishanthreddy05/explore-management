"use client";

import { useState } from "react";
import * as servicesService from "@/services/services";
import * as serviceCategoriesService from "@/services/serviceCategories";
import { useAppData } from "@/context/AppDataContext";
import type { Service } from "@/types/service";
import { Plus, Search, Edit2, Trash2, X, Scissors } from "lucide-react";
import { formatCurrency } from "@/components/salon-dashboard/types";
import { toast } from "react-hot-toast";

export default function ServicesPage() {
  const { services, refreshServices, loadingAppData, categories, refreshCategories } = useAppData();
  const loading = loadingAppData;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    price: 0,
    category: "",
  });

  // Inline category management states
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [loadingNewCategory, setLoadingNewCategory] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingService(null);
    setFormData({
      name: "",
      price: 0,
      category: categories[0]?.name || "",
    });
    setShowNewCategoryInput(false);
    setNewCategoryName("");
    setModalOpen(true);
  };

  const handleOpenEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      price: service.price,
      category: service.category || categories[0]?.name || "",
    });
    setShowNewCategoryInput(false);
    setNewCategoryName("");
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
      toast.success("Service deleted successfully!");
    } catch (error) {
      console.error("Failed to delete service:", error);
      toast.error("Failed to delete service.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category) {
      toast.error("Please select a category.");
      return;
    }
    try {
      if (editingService?.id) {
        await servicesService.update(editingService.id, formData);
        toast.success("Service updated successfully!");
      } else {
        await servicesService.create(formData);
        toast.success("Service created successfully!");
      }
      setModalOpen(false);
      await refreshServices();
    } catch (error) {
      console.error("Failed to save service:", error);
      toast.error("Failed to save service.");
    }
  };

  const handleAddNewCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      toast.error("Category name cannot be empty");
      return;
    }

    setLoadingNewCategory(true);
    try {
      // client-side duplicate check
      const titleCased = trimmed
        .replace(/\s+/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");

      const exists = categories.some(
        (c) => c.name.toLowerCase() === titleCased.toLowerCase()
      );
      if (exists) {
        toast.error(`Category "${titleCased}" already exists.`);
        setLoadingNewCategory(false);
        return;
      }

      await serviceCategoriesService.create(titleCased);
      await refreshCategories();
      setFormData((prev) => ({ ...prev, category: titleCased }));
      setShowNewCategoryInput(false);
      setNewCategoryName("");
      toast.success(`Category "${titleCased}" added successfully!`);
    } catch (error: any) {
      console.error("Failed to add category:", error);
      toast.error(error.message || "Failed to add category.");
    } finally {
      setLoadingNewCategory(false);
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
          {/* Category Cards Top Row */}
          <div className="mb-6 overflow-x-auto pb-2 scrollbar-thin">
            <div className="flex gap-4 min-w-max">
              {/* All Card */}
              <button
                onClick={() => setSelectedCategory("All")}
                className={`flex flex-col min-w-[120px] rounded-2xl border p-4 transition-all duration-200 cursor-pointer text-left shadow-sm ${
                  selectedCategory === "All"
                    ? "bg-[#B8962E] border-[#B8962E] text-[#0E0D0B] font-bold"
                    : "bg-[#131210] border-[#2E2B24] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F]"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                  Filter
                </span>
                <span className="mt-1 text-base font-extrabold">All Services</span>
                <span className="mt-2 text-xs font-semibold">
                  {services.length} {services.length === 1 ? "service" : "services"}
                </span>
              </button>

              {/* Dynamic Category Cards */}
              {categories.map((cat) => {
                const count = services.filter(
                  (s) => s.category?.toLowerCase() === cat.name.toLowerCase()
                ).length;

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`flex flex-col min-w-[140px] rounded-2xl border p-4 transition-all duration-200 cursor-pointer text-left shadow-sm ${
                      selectedCategory === cat.name
                        ? "bg-[#B8962E] border-[#B8962E] text-[#0E0D0B] font-bold"
                        : "bg-[#131210] border-[#2E2B24] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F]"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                      Category
                    </span>
                    <span className="mt-1 text-base font-extrabold truncate w-[105px]" title={cat.name}>
                      {cat.name}
                    </span>
                    <span className="mt-2 text-xs font-semibold">
                      {count} {count === 1 ? "service" : "services"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search bar */}
          <div className="mb-6 flex max-w-md items-center rounded-xl border border-[#2E2B24] bg-[#131210] px-4 h-12 shadow-sm focus-within:border-[#B8962E] transition">
            <Search size={18} className="text-[#6B6358] mr-2" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-[#F5F0E8] outline-none placeholder:text-[#6B6358]"
            />
          </div>

          {/* Grouped Services List Display */}
          {(() => {
            // Filter categories that should render based on selection and services match
            const categoriesToRender = categories.filter((cat) => {
              if (selectedCategory !== "All" && selectedCategory.toLowerCase() !== cat.name.toLowerCase()) {
                return false;
              }
              const catServices = filteredServices.filter(
                (s) => (s.category || "General").toLowerCase() === cat.name.toLowerCase()
              );
              return catServices.length > 0;
            });

            // Handle any services that have categories not tracked in current serviceCategories collection
            const untrackedCategories = Array.from(
              new Set(
                filteredServices
                  .map((s) => s.category || "General")
                  .filter(
                    (catName) =>
                      !categories.some((c) => c.name.toLowerCase() === catName.toLowerCase())
                  )
              )
            );

            const allCategoriesToRender = [
              ...categoriesToRender.map((c) => c.name),
              ...untrackedCategories.filter(
                (catName) =>
                  selectedCategory === "All" ||
                  selectedCategory.toLowerCase() === catName.toLowerCase()
              ),
            ];

            if (allCategoriesToRender.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-[#2E2B24] bg-[#131210] p-12 text-center shadow-md">
                  <p className="text-[#A89F8C]">No services found matching the criteria.</p>
                </div>
              );
            }

            return (
              <div className="space-y-8">
                {allCategoriesToRender.map((catName) => {
                  const catServices = filteredServices.filter(
                    (s) => (s.category || "General").toLowerCase() === catName.toLowerCase()
                  );

                  return (
                    <div key={catName} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-[#B8962E]">
                          {catName}
                        </h3>
                        <span className="rounded-full bg-[#1C1A16] border border-[#2E2B24] px-2 py-0.5 text-xs text-[#A89F8C]">
                          {catServices.length} {catServices.length === 1 ? "service" : "services"}
                        </span>
                        <div className="h-px flex-1 bg-[#2E2B24]" />
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#131210] shadow-md">
                        <table className="w-full min-w-[700px] border-collapse text-left text-sm text-[#A89F8C]">
                          <thead className="bg-[#0E0D0B] text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C] border-b border-[#2E2B24]">
                            <tr>
                              <th className="px-6 py-4 font-bold">Service Name</th>
                              <th className="px-6 py-4 font-bold">Price</th>
                              <th className="px-6 py-4 font-bold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2E2B24]">
                            {catServices.map((service) => (
                              <tr key={service.id} className="hover:bg-[#1C1A16] transition bg-transparent text-[#A89F8C]">
                                <td className="px-6 py-4 font-semibold text-[#F5F0E8]">{service.name}</td>
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
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
                  onChange={(e) => {
                    if (e.target.value === "ADD_NEW") {
                      setShowNewCategoryInput(true);
                    } else {
                      setShowNewCategoryInput(false);
                      setFormData({ ...formData, category: e.target.value });
                    }
                  }}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                  <option value="ADD_NEW">+ Add new category</option>
                </select>
              </label>

              {showNewCategoryInput && (
                <div className="mt-3 rounded-2xl border border-[#2E2B24] bg-[#0E0D0B] p-4 space-y-3">
                  <span className="text-xs font-semibold text-[#A89F8C]">New Category Name</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Nail Art"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="h-10 flex-1 rounded-xl border border-[#2E2B24] bg-[#131210] px-3 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] placeholder-[#6B6358]"
                    />
                    <button
                      type="button"
                      disabled={loadingNewCategory}
                      onClick={handleAddNewCategory}
                      className="h-10 rounded-xl bg-[#B8962E] px-4 text-xs font-bold text-[#0E0D0B] hover:bg-[#D4A935] transition disabled:opacity-50 cursor-pointer"
                    >
                      {loadingNewCategory ? "Adding..." : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCategoryInput(false);
                        setNewCategoryName("");
                      }}
                      className="h-10 rounded-xl border border-[#2E2B24] bg-[#131210] px-3 text-xs font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

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
