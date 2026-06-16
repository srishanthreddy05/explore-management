"use client";

import { useEffect, useState, useMemo } from "react";
import * as staffService from "@/services/staff";
import type { Staff } from "@/types/staff";
import { Plus, Search, Edit2, Trash2, X, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from "firebase/firestore";
import { useAppData } from "@/context/AppDataContext";

export default function StaffPage() {
  const { staff, refreshStaff, loadingAppData } = useAppData();
  const loading = loadingAppData;
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

  const loadStaffProgress = async () => {
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const monthKey = `${yyyy}-${mm}`;

      const revMap: Record<string, number> = {};
      const memMap: Record<string, number> = {};

      await Promise.all(
        staff.map(async (member) => {
          if (!member.id) return;
          const ref = doc(db, "stats", `staff_${member.id}_${monthKey}`);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data();
            revMap[member.id] = data.revenue ?? 0;
            memMap[member.id] = data.servicesCount ?? 0;
          } else {
            revMap[member.id] = 0;
            memMap[member.id] = 0;
          }
        })
      );

      setStaffRevenueMap(revMap);
      setStaffMemberMap(memMap);

    } catch (error) {
      console.error("Failed to load staff list progress:", error);
    }
  };

  useEffect(() => {
    if (staff && staff.length > 0) {
      loadStaffProgress();
    }
  }, [staff]);

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
      await refreshStaff();
      loadStaffProgress();
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
      await refreshStaff();
      loadStaffProgress();
    } catch (error) {
      console.error("Failed to save staff member:", error);
    }
  };

  const filteredStaff = staff.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedStaff = useMemo(() => {
    return [...filteredStaff].sort((a, b) => {
      const aIsOwner = a.role === "Owner";
      const bIsOwner = b.role === "Owner";
      if (aIsOwner && !bIsOwner) return -1;
      if (!aIsOwner && bIsOwner) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredStaff]);

  return (
    <div className="w-full text-[#A89F8C]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">
            Team
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#F5F0E8]">
            Staff Management
          </h1>
        </div>
        {!loading && staff.length > 0 && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] px-6 text-sm font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] shadow-sm transition duration-150 cursor-pointer"
          >
            <Plus size={18} />
            Add Staff
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-[#B8962E] border-t-transparent" />
        </div>
      ) : staff.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#2E2B24] bg-[#131210] p-12 text-center shadow-md">
          <div className="grid size-16 place-items-center rounded-2xl bg-[#0E0D0B] text-[#B8962E] border border-[#2E2B24] mb-4">
            <Users size={32} />
          </div>
          <h2 className="text-xl font-bold text-[#F5F0E8]">No Staff Found</h2>
          <p className="mt-2 max-w-sm text-sm text-[#A89F8C]">
            Enlist your salon specialists and stylists to assign their
            availability to appointments and calculate commissions.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] px-6 text-sm font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] shadow-sm transition duration-150 cursor-pointer"
          >
            <Plus size={18} />
            Add Staff
          </button>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="mb-4 flex max-w-md items-center rounded-xl border border-[#2E2B24] bg-[#131210] px-4 h-12 shadow-sm focus-within:border-[#B8962E] transition">
            <Search size={18} className="text-[#6B6358] mr-2" />
            <input
              type="text"
              placeholder="Search by name or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-[#F5F0E8] outline-none placeholder:text-[#6B6358]"
            />
          </div>

          {/* Staff Cards */}
          <div className="flex flex-col gap-4">
            {sortedStaff.map((stf) => {
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

              return (
                <div
                  key={stf.id}
                  className="rounded-2xl border border-[#2E2B24] bg-[#131210] p-5 shadow-sm hover:border-[#B8962E]/30 transition flex flex-col md:flex-row md:items-center justify-between gap-6 text-[#A89F8C]"
                >
                  {/* Left: Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6 min-w-[220px]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-[#F5F0E8] text-lg leading-tight">
                          {stf.name}
                        </h3>
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                          stf.role === "Owner"
                            ? "bg-[#1F1A0F] text-[#B8962E] border border-[#B8962E]/20"
                            : "bg-[#1C1A16] text-[#A89F8C] border border-[#2E2B24]"
                        }`}>
                          {stf.role}
                        </span>
                      </div>
                      
                      <div className="text-xs text-[#A89F8C] flex items-center gap-1.5">
                        <span className="font-semibold text-[10px] text-[#6B6358] uppercase tracking-wider">Phone:</span>
                        <span className="text-[#F5F0E8]">{stf.phone || <span className="italic text-[#6B6358]">No phone number</span>}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Targets */}
                  <div className="flex-1 min-w-[280px] pt-4 md:pt-0 border-t md:border-t-0 border-[#2E2B24]">
                    <span className="font-semibold block text-[10px] text-[#A89F8C] uppercase tracking-wider mb-2">Monthly Targets</span>
                    {!hasRevenueTarget && !hasMemberTarget ? (
                      <p className="text-xs text-[#6B6358] italic">No targets set</p>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {hasRevenueTarget && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-[#A89F8C]">
                              <span>Revenue: ₹{revenueAchieved.toLocaleString()} / ₹{revenueMonthly.toLocaleString()}</span>
                              <span className="font-bold text-[#B8962E]">{Math.round(revenuePercent)}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-[#0E0D0B] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#B8962E]"
                                style={{ width: `${revenuePercent}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {hasMemberTarget && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-[#A89F8C]">
                              <span>Servings: {memberAchieved} / {memberCountMonthly}</span>
                              <span className="font-bold text-[#B8962E]">{Math.round(memberPercent)}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-[#0E0D0B] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#B8962E]"
                                style={{ width: `${memberPercent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 pt-4 md:pt-0 border-t md:border-t-0 border-[#2E2B24] self-end md:self-auto min-w-[90px]">
                    <button
                      onClick={() => handleOpenEdit(stf)}
                      className="grid size-9 place-items-center rounded-xl bg-[#131210] border border-[#2E2B24] text-[#B8962E] hover:bg-[#1F1A0F] hover:border-[#B8962E] transition cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => stf.id && handleDeleteTrigger(stf.id)}
                      className="grid size-9 place-items-center rounded-xl bg-[#131210] border border-[#2E2B24] text-[#E57373] hover:bg-[#131210] hover:border-[#E57373] transition cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#A89F8C] overflow-y-auto max-h-[90vh] z-10 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-[#A89F8C] hover:text-[#B8962E] transition cursor-pointer"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-[#F5F0E8] mb-4">
              {editingStaff ? "Edit Stylist Profile" : "Register Team Specialist"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Name */}
              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">
                  Staff Name
                </span>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E] placeholder-[#6B6358]"
                  placeholder="e.g. Aarav Kapoor"
                />
              </label>

              {/* Phone */}
              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">
                  Phone Number
                </span>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E] placeholder-[#6B6358]"
                  placeholder="+91 98765 43210"
                />
              </label>

              {/* Role */}
              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">
                  Role / Specialization
                </span>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                >
                  <option value="Stylist">Stylist</option>
                  <option value="Owner">Owner</option>
                </select>
              </label>

              {/* Targets */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#A89F8C]">
                    Revenue Target / Month (₹)
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={formData.revenueMonthly === 0 ? "" : formData.revenueMonthly}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        revenueMonthly: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#A89F8C]">
                    Servings Target / Month
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={formData.memberCountMonthly === 0 ? "" : formData.memberCountMonthly}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        memberCountMonthly: e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                  />
                </label>
              </div>

              {/* Employment Status */}
              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">
                  Employment Status
                </span>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                >
                  <option value="Active">Active Duty</option>
                  <option value="Inactive">On Leave / Inactive</option>
                </select>
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDeleteConfirmOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-3xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#A89F8C] z-10 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#F5F0E8]">
              Are you sure you want to delete this record?
            </h3>
            <p className="mt-2 text-sm text-[#A89F8C]">
              This action cannot be undone and will remove the record
              immediately.
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}