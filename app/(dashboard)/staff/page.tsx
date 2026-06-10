"use client";

import { useEffect, useState } from "react";
import * as staffService from "@/services/staff";
import type { Staff } from "@/types/staff";
import { Plus, Search, Edit2, Trash2, X, Users } from "lucide-react";

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "Stylist",
    status: "Active",
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const data = await staffService.getAll();
      setStaff(data);
    } catch (error) {
      console.error("Failed to load staff list:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setFormData({
      name: "",
      role: "Stylist",
      status: "Active",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (stf: Staff) => {
    setEditingStaff(stf);
    setFormData({
      name: stf.name,
      role: stf.role,
      status: stf.status,
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
      await staffService.delete(idToDelete);
      setDeleteConfirmOpen(false);
      setIdToDelete(null);
      loadStaff();
    } catch (error) {
      console.error("Failed to delete staff member:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStaff?.id) {
        await staffService.update(editingStaff.id, formData);
      } else {
        await staffService.create(formData);
      }
      setModalOpen(false);
      loadStaff();
    } catch (error) {
      console.error("Failed to save staff member:", error);
    }
  };

  const filteredStaff = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full text-stone-900">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-stone-500">
            Team
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            Staff Management
          </h1>
        </div>
        {!loading && staff.length > 0 && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-850"
          >
            <Plus size={18} />
            Add Staff
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
        </div>
      ) : staff.length === 0 ? (
        // Empty State UI
        <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-md">
          <div className="grid size-16 place-items-center rounded-2xl bg-stone-100 text-stone-900 mb-4">
            <Users size={32} />
          </div>
          <h2 className="text-xl font-bold text-stone-900">No Staff Found</h2>
          <p className="mt-2 max-w-sm text-sm text-stone-500">
            Enlist your salon specialists and stylists to assign their availability to appointments and calculate commissions.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-850"
          >
            <Plus size={18} />
            Add Staff
          </button>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="mb-4 flex max-w-md items-center rounded-2xl border border-stone-200 bg-white px-4 h-12 shadow-sm focus-within:border-black">
            <Search size={18} className="text-stone-400 mr-2" />
            <input
              type="text"
              placeholder="Search by name or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
            />
          </div>

          {/* List display */}
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-md">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm text-stone-600">
              <thead className="bg-stone-55 text-xs uppercase tracking-[0.2em] text-stone-555 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-4 font-bold">Name</th>
                  <th className="px-6 py-4 font-bold">Role</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredStaff.map((stf) => (
                  <tr key={stf.id} className="hover:bg-stone-50 transition bg-white text-stone-900">
                    <td className="px-6 py-4 font-semibold text-stone-900">{stf.name}</td>
                    <td className="px-6 py-4">
                      <span className="inline-block rounded-full bg-stone-50 border border-stone-200 px-3 py-1 text-xs text-stone-700">
                        {stf.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                          stf.status === "Active"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-stone-100 text-stone-800 border border-stone-300"
                        }`}
                      >
                        {stf.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(stf)}
                          className="grid size-10 place-items-center rounded-xl border border-stone-200 text-stone-400 hover:text-black hover:border-black transition"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => stf.id && handleDeleteTrigger(stf.id)}
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
              {editingStaff ? "Edit Stylist Profile" : "Register Team Specialist"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Staff Name</span>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  placeholder="e.g. Aarav Kapoor"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Role / Specialization</span>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                >
                  <option value="Stylist">Hair Stylist</option>
                  <option value="Aesthetician">Aesthetician (Skin)</option>
                  <option value="Manicurist">Manicurist (Nails)</option>
                  <option value="Therapist">Massage Therapist</option>
                  <option value="Receptionist">Receptionist</option>
                  <option value="Manager">Salon Manager</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Employment Status</span>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                >
                  <option value="Active">Active Duty</option>
                  <option value="Inactive">On Leave / Inactive</option>
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
                  Save Specialist
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
            <h3 className="text-lg font-bold text-stone-900">Are you sure you want to delete this record?</h3>
            <p className="mt-2 text-sm text-stone-500">This action cannot be undone and will remove the record immediately.</p>
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
