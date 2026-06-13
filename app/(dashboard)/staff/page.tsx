"use client";

import { useEffect, useState } from "react";
import * as staffService from "@/services/staff";
import type { Staff } from "@/types/staff";
import { Plus, Search, Edit2, Trash2, X, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    role: "Stylist",
    status: "Active",
    revenueMonthly: 0,
    memberCountMonthly: 0,
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const [staffRevenueMap, setStaffRevenueMap] = useState<Record<string, number>>({});
  const [staffMemberMap, setStaffMemberMap] = useState<Record<string, number>>({});

  const loadStaff = async () => {
    setLoading(true);
    try {
      const data = await staffService.getAll();
      setStaff(data);

      // Fetch current month's invoices to compute stylist target progress
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, "invoices"),
        where("date", ">=", Timestamp.fromDate(startOfMonth)),
        where("date", "<=", Timestamp.fromDate(endOfMonth))
      );
      const querySnapshot = await getDocs(q);

      const revMap: Record<string, number> = {};
      const memMap: Record<string, number> = {};

      querySnapshot.forEach((docSnap) => {
        const inv = docSnap.data();

        // 1. Group services amount by staffId
        (inv.services || []).forEach((s: any) => {
          if (s.staffId) {
            const amount = s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
            revMap[s.staffId] = (revMap[s.staffId] || 0) + amount;
          }
        });

        // 2. Group membership counts by staffId
        if (inv.customerType === "membership") {
          (inv.services || []).forEach((s: any) => {
            if (s.staffId) {
              memMap[s.staffId] = (memMap[s.staffId] || 0) + 1;
            }
          });
        }
      });

      setStaffRevenueMap(revMap);
      setStaffMemberMap(memMap);

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
      phone: "",
      role: "Stylist",
      status: "Active",
      revenueMonthly: 0,
      memberCountMonthly: 0,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (stf: Staff) => {
    setEditingStaff(stf);
    setFormData({
      name: stf.name,
      phone: stf.phone || "",
      role: stf.role,
      status: stf.status,
      revenueMonthly: stf.targets?.revenueMonthly || 0,
      memberCountMonthly: stf.targets?.memberCountMonthly || 0,
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
    const payload = {
      name: formData.name,
      phone: formData.phone,
      role: formData.role,
      status: formData.status,
      targets: {
        revenueMonthly: Number(formData.revenueMonthly),
        memberCountMonthly: Number(formData.memberCountMonthly),
      },
    };
    try {
      if (editingStaff?.id) {
        await staffService.update(editingStaff.id, payload);
      } else {
        await staffService.create(payload);
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
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-800"
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
        <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-md">
          <div className="grid size-16 place-items-center rounded-2xl bg-stone-100 text-stone-900 mb-4">
            <Users size={32} />
          </div>
          <h2 className="text-xl font-bold text-stone-900">No Staff Found</h2>
          <p className="mt-2 max-w-sm text-sm text-stone-500">
            Enlist your salon specialists and stylists to assign their
            availability to appointments and calculate commissions.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-800"
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

          {/* Staff table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm text-stone-600">
              <thead className="bg-stone-50 text-xs uppercase tracking-[0.2em] text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-4 font-bold">Name</th>
                  <th className="px-6 py-4 font-bold">Phone</th>
                  <th className="px-6 py-4 font-bold">Target</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredStaff.map((stf) => (
                  <tr
                    key={stf.id}
                    className="hover:bg-stone-50 transition bg-white text-stone-900"
                  >
                    <td className="px-6 py-4 font-semibold text-stone-900">
                      {stf.name}
                    </td>
                    <td className="px-6 py-4 text-stone-600">
                      {stf.phone || (
                        <span className="italic text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const revenueAchieved = stf.id ? (staffRevenueMap[stf.id] ?? 0) : 0;
                        const revenueMonthly = stf.targets?.revenueMonthly ?? 0;
                        const revenuePercent = revenueMonthly > 0
                          ? Math.min((revenueAchieved / revenueMonthly) * 100, 100)
                          : 0;

                        const memberAchieved = stf.id ? (staffMemberMap[stf.id] ?? 0) : 0;
                        const memberCountMonthly = stf.targets?.memberCountMonthly ?? 0;
                        const memberPercent = memberCountMonthly > 0
                          ? Math.min((memberAchieved / memberCountMonthly) * 100, 100)
                          : 0;

                        const hasRevenueTarget = revenueMonthly > 0;
                        const hasMemberTarget = memberCountMonthly > 0;

                        if (!hasRevenueTarget && !hasMemberTarget) {
                          return <span className="text-xs text-stone-400 italic">No targets set</span>;
                        }

                        return (
                          <div className="min-w-[160px] space-y-3">
                            {hasRevenueTarget && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-stone-500">
                                  <span>
                                    ₹{revenueAchieved.toLocaleString()} / ₹{revenueMonthly.toLocaleString()}
                                  </span>
                                  <span className="font-bold text-stone-700">
                                    {Math.round(revenuePercent)}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-emerald-500"
                                    style={{ width: `${revenuePercent}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {hasMemberTarget && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-stone-500">
                                  <span>
                                    {memberAchieved} / {memberCountMonthly} members
                                  </span>
                                  <span className="font-bold text-stone-700">
                                    {Math.round(memberPercent)}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-blue-500"
                                    style={{ width: `${memberPercent}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
                          onClick={() =>
                            stf.id && handleDeleteTrigger(stf.id)
                          }
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

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl text-stone-900 overflow-y-auto max-h-[90vh]">
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

              {/* Name */}
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">
                  Staff Name
                </span>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  placeholder="e.g. Aarav Kapoor"
                />
              </label>

              {/* Phone */}
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">
                  Phone Number
                </span>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  placeholder="+91 98765 43210"
                />
              </label>

              {/* Role */}
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">
                  Role / Specialization
                </span>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
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

              {/* Targets */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">
                    Revenue Target / Month (₹)
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={formData.revenueMonthly}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        revenueMonthly: Number(e.target.value),
                      })
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">
                    Membership Target / Month
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={formData.memberCountMonthly}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        memberCountMonthly: Number(e.target.value),
                      })
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  />
                </label>
              </div>

              {/* Employment Status */}
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">
                  Employment Status
                </span>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
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
                  className="h-11 rounded-xl bg-black px-6 text-sm font-semibold text-white hover:bg-stone-800 transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirmOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl text-stone-900 z-10">
            <h3 className="text-lg font-bold text-stone-900">
              Are you sure you want to delete this record?
            </h3>
            <p className="mt-2 text-sm text-stone-500">
              This action cannot be undone and will remove the record
              immediately.
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}