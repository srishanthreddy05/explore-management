"use client";

import { useEffect, useState, useMemo } from "react";
import * as staffService from "@/services/staff";
import type { Staff } from "@/types/staff";
import { Plus, Search, Edit2, Trash2, X, Users, CalendarDays } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { useAppData } from "@/context/AppDataContext";
import { computeStaffPerformance, ServiceBreakdownItem } from "@/lib/utils/staffPerformance";
import { ServiceBreakdownModal } from "@/components/ui/ServiceBreakdownModal";

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

  const [periodPreset, setPeriodPreset] = useState("this-month");
  const [selectedMonth, setSelectedMonth] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; });
  const [customStart, setCustomStart] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; });
  const [customEnd, setCustomEnd] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; });
  const [monthlyInvoices, setMonthlyInvoices] = useState<any[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [breakdownModal, setBreakdownModal] = useState<{
    staffName: string;
    title: string;
    breakdown: ServiceBreakdownItem[];
  } | null>(null);

  const selectedRange = useMemo(() => {
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const toKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    if (periodPreset === "custom") return { start: customStart, end: customEnd, label: `${customStart} to ${customEnd}`, isSingleMonth: false };
    if (periodPreset === "selected-month") {
      const [year,month] = selectedMonth.split("-").map(Number); const first = new Date(year,month-1,1); const last = new Date(year,month,0);
      return { start: toKey(first), end: toKey(last), label: first.toLocaleDateString("en-IN",{month:"long",year:"numeric"}), isSingleMonth: true };
    }
    const offset = periodPreset === "last-month" ? -1 : 0; const monthStart = new Date(now.getFullYear(),now.getMonth()+offset,1);
    const start = periodPreset === "last-3-months" ? new Date(now.getFullYear(),now.getMonth()-2,1) : periodPreset === "last-6-months" ? new Date(now.getFullYear(),now.getMonth()-5,1) : monthStart;
    const end = periodPreset === "last-month" ? new Date(now.getFullYear(),now.getMonth(),0) : today;
    const label = periodPreset === "this-month" ? "This month" : periodPreset === "last-month" ? "Previous month" : periodPreset === "last-3-months" ? "Last 3 months" : "Last 6 months";
    return { start: toKey(start), end: toKey(end), label, isSingleMonth: periodPreset === "this-month" || periodPreset === "last-month" };
  }, [periodPreset, selectedMonth, customStart, customEnd]);

  useEffect(() => {
    if (!selectedRange.start || !selectedRange.end || selectedRange.start > selectedRange.end) { setMonthlyInvoices([]); return; }
    let cancelled = false;
    const fetchInvoices = async () => {
      setInvoiceLoading(true);
      try {
        const [sy,sm,sd] = selectedRange.start.split("-").map(Number); const [ey,em,ed] = selectedRange.end.split("-").map(Number);
        const from = new Date(sy,sm-1,sd,0,0,0,0); const to = new Date(ey,em-1,ed,23,59,59,999);
        const invoicesQuery = query(collection(db,"invoices"),where("date",">=",Timestamp.fromDate(from)),where("date","<=",Timestamp.fromDate(to)));
        const snapshot = await getDocs(invoicesQuery);
        if (!cancelled) setMonthlyInvoices(snapshot.docs.map((item)=>({id:item.id,...item.data()})));
      } catch(error) { console.error("Failed to load staff performance invoices:",error); if(!cancelled) setMonthlyInvoices([]); }
      finally { if(!cancelled) setInvoiceLoading(false); }
    };
    fetchInvoices(); return () => { cancelled = true; };
  }, [selectedRange.start, selectedRange.end]);

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

          <div className="mb-5 rounded-2xl border border-[#2E2B24] bg-[#131210] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#A89F8C]"><CalendarDays size={15} className="text-[#B8962E]" /> Performance Period</div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={periodPreset} onChange={(e)=>setPeriodPreset(e.target.value)} className="h-10 min-w-[180px] rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-3 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E]">
                <option value="this-month">This month</option><option value="last-month">Previous month</option><option value="selected-month">Select a month</option><option value="last-3-months">Last 3 months</option><option value="last-6-months">Last 6 months</option><option value="custom">Custom date range</option>
              </select>
              {periodPreset==="selected-month" && <input type="month" value={selectedMonth} onChange={(e)=>setSelectedMonth(e.target.value)} className="h-10 rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-3 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E]" aria-label="Select performance month" />}
              {periodPreset==="custom" && <><input type="date" value={customStart} max={customEnd} onChange={(e)=>setCustomStart(e.target.value)} className="h-10 rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-3 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E]" aria-label="Start date" /><span className="text-xs text-[#6B6358]">to</span><input type="date" value={customEnd} min={customStart} onChange={(e)=>setCustomEnd(e.target.value)} className="h-10 rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-3 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E]" aria-label="End date" /></>}
              <span className="ml-auto text-xs text-[#B8962E]">{selectedRange.label}</span>
            </div>
            {invoiceLoading && <p className="mt-2 text-xs text-[#6B6358]">Loading performance data…</p>}
          </div>

          {/* Staff Cards */}
          <div className="flex flex-col gap-4">
            {sortedStaff.map((stf) => {
              const revenueAchieved = computeStaffPerformance(monthlyInvoices, stf, selectedRange.start, selectedRange.end).serviceRevenue;
              const revenueMonthly = stf.targets?.revenueMonthly ?? 0;
              const revenuePercent = revenueMonthly > 0
                ? Math.min((revenueAchieved / revenueMonthly) * 100, 100)
                : 0;

              const memberAchieved = computeStaffPerformance(monthlyInvoices, stf, selectedRange.start, selectedRange.end).servicesTotal;
              const memberCountMonthly = stf.targets?.memberCountMonthly ?? 0;
              const memberPercent = memberCountMonthly > 0
                ? Math.min((memberAchieved / memberCountMonthly) * 100, 100)
                : 0;

              const hasRevenueTarget = revenueMonthly > 0 && selectedRange.isSingleMonth;
              const hasMemberTarget = memberCountMonthly > 0 && selectedRange.isSingleMonth;

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

                  {/* Middle: Performance & Targets */}
                  <div className="flex-1 min-w-[280px] pt-4 md:pt-0 border-t md:border-t-0 border-[#2E2B24] space-y-3">
                    {(() => {
                      const perf = computeStaffPerformance(monthlyInvoices, stf, selectedRange.start, selectedRange.end);
                      const money = (value: number) => `₹${value.toLocaleString("en-IN",{maximumFractionDigits:2})}`;
                      return <div className="space-y-3">
                        <div className="rounded-xl border border-[#2E2B24] bg-[#0E0D0B]/60 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-[#A89F8C]">Services Completed</span><span className="text-sm font-black text-[#60A5FA]">{perf.servicesTotal} {perf.servicesTotal===1?"service":"services"}</span></div>
                          {perf.servicesBreakdown.length ? <div className="flex flex-wrap items-center gap-1 pt-1">
                            {perf.servicesBreakdown.slice(0,4).map(item=><span key={item.name} className="inline-flex items-center gap-1 rounded-lg bg-[#1C1A16] border border-[#2E2B24] px-2 py-0.5 text-[10px] font-semibold text-[#F5F0E8]"><span>{item.name}</span><span className="text-[#60A5FA] font-bold">×{item.count}</span></span>)}
                            <button type="button" onClick={()=>setBreakdownModal({staffName:stf.name,title:`Services Completed · ${selectedRange.label}`,breakdown:perf.servicesBreakdown})} className="inline-flex items-center gap-1 rounded-lg bg-[#1F1A0F] border border-[#B8962E]/40 px-2 py-0.5 text-[10px] font-bold text-[#B8962E] hover:bg-[#2A2310] transition cursor-pointer">{perf.servicesBreakdown.length>4?`View all (+${perf.servicesBreakdown.length-4})`:"View breakdown"}</button>
                          </div>:<p className="text-xs text-[#6B6358]">No services in this period.</p>}
                        </div>
                        <div className="rounded-xl border border-[#2E2B24] bg-[#0E0D0B]/60 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-[#A89F8C]">Products Used</span><span className="text-sm font-black text-[#4ADE80]">{perf.productsUsedTotal} {perf.productsUsedTotal===1?"use":"uses"}</span></div>
                          {perf.productsUsedBreakdown.length ? <>
                            <div className="flex flex-wrap items-center gap-1 pt-1">{perf.productsUsedBreakdown.slice(0,3).map(item=><span key={item.name} className="inline-flex items-center gap-1 rounded-lg bg-[#1C1A16] border border-[#2E2B24] px-2 py-0.5 text-[10px] font-semibold text-[#F5F0E8]"><span>{item.name}</span><span className="text-[#4ADE80] font-bold">×{item.count}</span></span>)}<button type="button" onClick={()=>setBreakdownModal({staffName:stf.name,title:`Products Used · ${selectedRange.label}`,breakdown:perf.productsUsedBreakdown})} className="inline-flex items-center gap-1 rounded-lg bg-[#1F1A0F] border border-[#B8962E]/40 px-2 py-0.5 text-[10px] font-bold text-[#B8962E] hover:bg-[#2A2310] transition cursor-pointer">View all</button></div>
                            <div className="flex justify-between border-t border-[#2E2B24] pt-2 text-[10px]"><span className="text-[#6B6358]">Total consumption cost</span><span className="font-bold text-[#B8962E]">{money(perf.productsUsedBreakdown.reduce((sum,item)=>sum+(item.totalCost||0),0))}</span></div>
                          </>:<p className="text-xs text-[#6B6358]">No mapped products used in this period.</p>}
                        </div>
                        <div className="flex items-center justify-between text-xs"><span className="text-[#A89F8C]">Service revenue in period</span><span className="font-bold text-[#F5F0E8]">{money(perf.serviceRevenue)}</span></div>
                      </div>;
                    })()}

                    {/* Monthly Targets */}
                    <div>
                      <span className="font-semibold block text-[10px] text-[#A89F8C] uppercase tracking-wider mb-2">{selectedRange.isSingleMonth ? "Monthly Targets" : "Targets (select one month to compare)"}</span>
                      {!hasRevenueTarget && !hasMemberTarget ? (
                        <p className="text-xs text-[#6B6358] italic">{selectedRange.isSingleMonth ? "No targets set" : "Target comparisons are available for single-month periods."}</p>
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
                                <span>Target: {memberAchieved} / {memberCountMonthly}</span>
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
      {/* Service Breakdown Modal */}
      {breakdownModal && (
        <ServiceBreakdownModal
          isOpen={!!breakdownModal}
          onClose={() => setBreakdownModal(null)}
          staffName={breakdownModal.staffName}
          title={breakdownModal.title}
          breakdown={breakdownModal.breakdown}
        />
      )}
    </div>
  );
}