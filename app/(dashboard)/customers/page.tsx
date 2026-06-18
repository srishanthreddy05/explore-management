"use client";

import { useEffect, useState } from "react";
import * as customerService from "@/services/customers";
import * as invoicesService from "@/services/invoices";
import type { Customer } from "@/types/customer";
import { Plus, Search, Edit2, Trash2, X, Users, Eye } from "lucide-react";
import CustomerDetailModal from "@/components/customers/CustomerDetailModal";
import { db } from "@/lib/firebase";
import { toast } from "react-hot-toast";
import {
  query,
  collection,
  where,
  limit,
  getDocs,
  startAfter,
  orderBy,
} from "firebase/firestore";
import { toTitleCase } from "@/lib/utils/text";
import { toLocalDateString } from "@/lib/utils/date";


export default function CustomersPage() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({ regularCount: 0, membershipCount: 0 });

  // Customer states
  const [regularCustomers, setRegularCustomers] = useState<Customer[]>([]);
  const [membershipCustomers, setMembershipCustomers] = useState<Customer[]>([]);
  const [searchResults, setSearchResults] = useState<Customer[]>([]);

  // Pagination cursors
  const [lastRegularDoc, setLastRegularDoc] = useState<any>(null);
  const [lastMembershipDoc, setLastMembershipDoc] = useState<any>(null);

  // Completion flags
  const [hasMoreRegular, setHasMoreRegular] = useState(false);
  const [hasMoreMembership, setHasMoreMembership] = useState(false);

  // Loading more states
  const [loadingMoreRegular, setLoadingMoreRegular] = useState(false);
  const [loadingMoreMembership, setLoadingMoreMembership] = useState(false);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    customerType: "regular" as "regular" | "membership",
    membershipAmount: "",
    membershipDuration: "",
    membershipStart: "",
    paymentMethod: "UPI" as "UPI" | "Cash" | "Card",
    recordInvoice: false,
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Customer | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadStats = async () => {
    const s = await customerService.getStats();
    setStats(s);
  };

  const loadRegular = async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMoreRegular(true);
    }
    try {
      let q = query(
        collection(db, "customers"),
        where("customerType", "==", "regular"),
        orderBy("name", "asc"),
        limit(10)
      );

      if (isLoadMore && lastRegularDoc) {
        q = query(
          collection(db, "customers"),
          where("customerType", "==", "regular"),
          orderBy("name", "asc"),
          startAfter(lastRegularDoc),
          limit(10)
        );
      }

      const snap = await getDocs(q);
      const docs = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Customer
      );

      if (isLoadMore) {
        setRegularCustomers((prev) => [...prev, ...docs]);
      } else {
        setRegularCustomers(docs);
      }

      if (snap.docs.length > 0) {
        setLastRegularDoc(snap.docs[snap.docs.length - 1]);
      } else if (!isLoadMore) {
        setLastRegularDoc(null);
      }
      setHasMoreRegular(snap.docs.length === 10);
    } catch (error) {
      console.error("Error loading regular customers:", error);
    } finally {
      if (isLoadMore) {
        setLoadingMoreRegular(false);
      }
    }
  };

  const loadMembership = async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMoreMembership(true);
    }
    try {
      let q = query(
        collection(db, "customers"),
        where("customerType", "==", "membership"),
        orderBy("name", "asc"),
        limit(10)
      );

      if (isLoadMore && lastMembershipDoc) {
        q = query(
          collection(db, "customers"),
          where("customerType", "==", "membership"),
          orderBy("name", "asc"),
          startAfter(lastMembershipDoc),
          limit(10)
        );
      }

      const snap = await getDocs(q);
      const docs = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Customer
      );

      if (isLoadMore) {
        setMembershipCustomers((prev) => [...prev, ...docs]);
      } else {
        setMembershipCustomers(docs);
      }

      if (snap.docs.length > 0) {
        setLastMembershipDoc(snap.docs[snap.docs.length - 1]);
      } else if (!isLoadMore) {
        setLastMembershipDoc(null);
      }
      setHasMoreMembership(snap.docs.length === 10);
    } catch (error) {
      console.error("Error loading membership customers:", error);
    } finally {
      if (isLoadMore) {
        setLoadingMoreMembership(false);
      }
    }
  };

  const runSearch = async (queryString: string) => {
    if (!queryString.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const isPhone = /^\d+$/.test(queryString);
      let q;
      if (isPhone) {
        q = query(
          collection(db, "customers"),
          where("phone", ">=", queryString),
          where("phone", "<=", queryString + "\uf8ff"),
          limit(10)
        );
      } else {
        const formatted = toTitleCase(queryString);
        q = query(
          collection(db, "customers"),
          where("name", ">=", formatted),
          where("name", "<=", formatted + "\uf8ff"),
          limit(10)
        );
      }
      const snap = await getDocs(q);
      const results = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Customer
      );
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching customers:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  const initializeData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadRegular(false),
        loadMembership(false),
      ]);
    } catch (error) {
      console.error("Initialization error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeData();
  }, []);

  useEffect(() => {
    if (debouncedQuery.trim()) {
      runSearch(debouncedQuery);
    } else {
      setSearchResults([]);
    }
  }, [debouncedQuery]);

  const handleOpenDetail = (customer: Customer) => {
    setSelectedCustomerForDetail(customer);
    setDetailModalOpen(true);
  };

  const handleRefresh = async () => {
    await initializeData();
    if (debouncedQuery.trim()) {
      runSearch(debouncedQuery);
    }
  };

  const calculateMembershipEnd = (start: string, months: number): string => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + months);
    return d.toISOString();
  };

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: "",
      phone: "",
      customerType: "regular",
      membershipAmount: "",
      membershipDuration: "",
      membershipStart: toLocalDateString(new Date()),
      paymentMethod: "UPI",
      recordInvoice: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || "",
      phone: customer.phone || "",
      customerType: customer.customerType || "regular",
      membershipAmount: customer.membershipAmount?.toString() || "",
      membershipDuration: customer.membershipDuration?.toString() || "",
      membershipStart: customer.membershipStart ? toLocalDateString(customer.membershipStart) : toLocalDateString(new Date()),
      paymentMethod: "UPI",
      recordInvoice: false,
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
      await customerService.delete(idToDelete);
      toast.success("Customer deleted successfully!");
      setDeleteConfirmOpen(false);
      setIdToDelete(null);
      await handleRefresh();
    } catch (error: any) {
      console.error("Failed to delete customer:", error);
      if (error?.code === "failed-precondition" || error?.message?.includes("failed-precondition")) {
        toast.error("This customer was already removed — list refreshed");
      } else {
        toast.error("Failed to delete customer.");
      }
      setDeleteConfirmOpen(false);
      setIdToDelete(null);
      await handleRefresh();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        name: formData.name,
        phone: formData.phone,
        customerType: formData.customerType,
        ...(formData.customerType === "membership" ? {
          membershipAmount: parseFloat(formData.membershipAmount) || 0,
          membershipDuration: parseInt(formData.membershipDuration) || 0,
          membershipStart: new Date(formData.membershipStart).toISOString(),
          membershipEnd: calculateMembershipEnd(formData.membershipStart, parseInt(formData.membershipDuration) || 0),
        } : {
          membershipAmount: null,
          membershipDuration: null,
          membershipStart: null,
          membershipEnd: null,
        })
      };

      let customerId = editingCustomer?.id;
      if (editingCustomer?.id) {
        await customerService.update(editingCustomer.id, dataToSave);
      } else {
        customerId = await customerService.create(dataToSave);
      }

      if (formData.customerType === "membership" && formData.recordInvoice && customerId) {
        await invoicesService.createMembershipInvoice({
          customerId,
          customerName: formData.name.trim(),
          customerPhone: formData.phone.trim(),
          membershipAmount: parseFloat(formData.membershipAmount) || 0,
          paymentMethod: formData.paymentMethod,
          dateString: formData.membershipStart,
        });
      }

      setModalOpen(false);
      await handleRefresh();
    } catch (error) {
      console.error("Failed to save customer:", error);
    }
  };

  const regularToDisplay = debouncedQuery.trim()
    ? searchResults.filter((c) => c.customerType === "regular" || !c.customerType)
    : regularCustomers;

  const membershipToDisplay = debouncedQuery.trim()
    ? searchResults.filter((c) => c.customerType === "membership")
    : membershipCustomers;

  const regularHeader = debouncedQuery.trim()
    ? `Regular Customers (${regularToDisplay.length} found)`
    : `Regular Customers (${stats.regularCount})`;

  const membershipHeader = debouncedQuery.trim()
    ? `Membership Customers (${membershipToDisplay.length} found)`
    : `Membership Customers (${stats.membershipCount})`;

  return (
    <div className="w-full text-[#A89F8C]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">
            CRM
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#F5F0E8]">
            Customers ({stats.regularCount + stats.membershipCount})
          </h1>
        </div>

      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-[#B8962E] border-t-transparent" />
        </div>
      ) : (stats.regularCount + stats.membershipCount) === 0 ? (
        // Empty State UI
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#2E2B24] bg-[#131210] p-12 text-center shadow-md">
          <div className="grid size-16 place-items-center rounded-2xl bg-[#0E0D0B] text-[#B8962E] border border-[#2E2B24] mb-4">
            <Users size={32} />
          </div>
          <h2 className="text-xl font-bold text-[#F5F0E8]">No Customers Found</h2>
          <p className="mt-2 max-w-sm text-sm text-[#A89F8C]">
            Create profiles to track salon memberships and schedule visits.
          </p>

        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="mb-6 flex max-w-md items-center rounded-xl border border-[#2E2B24] bg-[#131210] px-4 h-12 shadow-sm focus-within:border-[#B8962E] transition">
            {searchLoading ? (
              <div className="size-4 animate-spin rounded-full border-2 border-[#B8962E] border-t-transparent mr-2 shrink-0" />
            ) : (
              <Search size={18} className="text-[#6B6358] mr-2 shrink-0" />
            )}
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-[#F5F0E8] outline-none placeholder:text-[#6B6358]"
            />
          </div>

          {/* List display: 2 columns side-by-side */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Regular Customers Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#2E2B24] pb-2">
                <h2 className="text-lg font-bold text-[#F5F0E8]">
                  {regularHeader}
                </h2>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#131210] shadow-md">
                <table className="w-full min-w-[340px] border-collapse text-left text-sm text-[#A89F8C]">
                  <thead className="bg-[#0E0D0B] text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C] border-b border-[#2E2B24]">
                    <tr>
                      <th className="px-4 py-3.5 font-bold">Name</th>
                      <th className="px-4 py-3.5 font-bold">Phone</th>
                      <th className="px-4 py-3.5 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2E2B24]">
                    {regularToDisplay.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-[#6B6358] font-medium italic bg-transparent">
                          {debouncedQuery.trim()
                            ? "No matching regular customers."
                            : "No regular customers."}
                        </td>
                      </tr>
                    ) : (
                      regularToDisplay.map((customer) => (
                        <tr key={customer.id} className="hover:bg-[#1C1A16] transition bg-transparent text-[#A89F8C]">
                          <td className="px-4 py-3 font-semibold text-[#F5F0E8]">{customer.name}</td>
                          <td className="px-4 py-3 font-medium">{customer.phone}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenDetail(customer)}
                                className="grid size-8 place-items-center rounded-lg border border-[#2E2B24] bg-[#131210] text-[#A89F8C] hover:text-[#B8962E] hover:border-[#B8962E] transition cursor-pointer"
                                title="View Details"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(customer)}
                                className="grid size-8 place-items-center rounded-lg bg-[#131210] border border-[#2E2B24] text-[#B8962E] hover:bg-[#1F1A0F] hover:border-[#B8962E] transition cursor-pointer"
                                title="Edit"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => customer.id && handleDeleteTrigger(customer.id)}
                                className="grid size-8 place-items-center rounded-lg bg-[#131210] border border-[#2E2B24] text-[#E57373] hover:bg-[#131210] hover:border-[#E57373] transition cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {!debouncedQuery.trim() && hasMoreRegular && (
                <button
                  onClick={() => loadRegular(true)}
                  disabled={loadingMoreRegular}
                  className="w-full h-11 border border-[#2E2B24] bg-[#131210] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] rounded-2xl text-sm font-semibold text-[#A89F8C] transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loadingMoreRegular && (
                    <div className="size-4 animate-spin rounded-full border-2 border-[#B8962E] border-t-transparent" />
                  )}
                  {loadingMoreRegular ? "Loading..." : "Load More"}
                </button>
              )}
            </div>

            {/* Membership Customers Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#2E2B24] pb-2">
                <h2 className="text-lg font-bold text-[#B8962E]">
                  {membershipHeader}
                </h2>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#131210] shadow-md">
                <table className="w-full min-w-[340px] border-collapse text-left text-sm text-[#A89F8C]">
                  <thead className="bg-[#0E0D0B] text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C] border-b border-[#2E2B24]">
                    <tr>
                      <th className="px-4 py-3.5 font-bold">Name</th>
                      <th className="px-4 py-3.5 font-bold">Phone</th>
                      <th className="px-4 py-3.5 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2E2B24]">
                    {membershipToDisplay.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-[#6B6358] font-medium italic bg-transparent">
                          {debouncedQuery.trim()
                            ? "No matching membership customers."
                            : "No membership customers."}
                        </td>
                      </tr>
                    ) : (
                      membershipToDisplay.map((customer) => (
                        <tr key={customer.id} className="hover:bg-[#1C1A16] transition bg-transparent text-[#A89F8C]">
                          <td className="px-4 py-3 font-semibold text-[#F5F0E8]">{customer.name}</td>
                          <td className="px-4 py-3 font-medium">{customer.phone}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenDetail(customer)}
                                className="grid size-8 place-items-center rounded-lg border border-[#2E2B24] bg-[#131210] text-[#A89F8C] hover:text-[#B8962E] hover:border-[#B8962E] transition cursor-pointer"
                                title="View Details"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(customer)}
                                className="grid size-8 place-items-center rounded-lg bg-[#131210] border border-[#2E2B24] text-[#B8962E] hover:bg-[#1F1A0F] hover:border-[#B8962E] transition cursor-pointer"
                                title="Edit"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => customer.id && handleDeleteTrigger(customer.id)}
                                className="grid size-8 place-items-center rounded-lg bg-[#131210] border border-[#2E2B24] text-[#E57373] hover:bg-[#131210] hover:border-[#E57373] transition cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {!debouncedQuery.trim() && hasMoreMembership && (
                <button
                  onClick={() => loadMembership(true)}
                  disabled={loadingMoreMembership}
                  className="w-full h-11 border border-[#2E2B24] bg-[#131210] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] rounded-2xl text-sm font-semibold text-[#A89F8C] transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loadingMoreMembership && (
                    <div className="size-4 animate-spin rounded-full border-2 border-[#B8962E] border-t-transparent" />
                  )}
                  {loadingMoreMembership ? "Loading..." : "Load More"}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal Overlay Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#A89F8C] animate-in zoom-in-95 duration-200 z-10 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-[#A89F8C] hover:text-[#B8962E] transition cursor-pointer"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-[#F5F0E8] mb-4">
              {editingCustomer ? "Edit Customer Details" : "Add Customer"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Name</span>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E] placeholder-[#6B6358]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Phone Number</span>
                <input
                  required
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E] placeholder-[#6B6358]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Customer Type</span>
                <select
                  value={formData.customerType}
                  onChange={(e) => {
                    const newType = e.target.value as "regular" | "membership";
                    setFormData({
                      ...formData,
                      customerType: newType,
                      recordInvoice: newType === "membership" ? (editingCustomer?.customerType !== "membership") : false
                    });
                  }}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                >
                  <option value="regular">Regular</option>
                  <option value="membership">Membership</option>
                </select>
              </label>

              {formData.customerType === "membership" && (
                <div className="space-y-4 border-l-2 border-[#2E2B24] pl-3 mt-3 animate-in slide-in-from-left-2 duration-200">
                  <label className="block">
                    <span className="text-sm font-semibold text-[#A89F8C]">Membership Amount (₹)</span>
                    <input
                      required
                      type="number"
                      placeholder="e.g. 5000"
                      value={formData.membershipAmount}
                      onChange={(e) => setFormData({ ...formData, membershipAmount: e.target.value })}
                      className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-[#A89F8C]">Duration (in months)</span>
                    <input
                      required
                      type="number"
                      placeholder="e.g. 3"
                      value={formData.membershipDuration}
                      onChange={(e) => setFormData({ ...formData, membershipDuration: e.target.value })}
                      className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-[#A89F8C]">Start Date</span>
                    <input
                      required
                      type="date"
                      value={formData.membershipStart}
                      onChange={(e) => setFormData({ ...formData, membershipStart: e.target.value })}
                      className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-[#A89F8C]">Payment Method</span>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as "UPI" | "Cash" | "Card" })}
                      className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                    >
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                    </select>
                  </label>

                  <div className="flex items-center gap-2.5 pt-2">
                    <input
                      type="checkbox"
                      id="recordInvoice"
                      checked={formData.recordInvoice}
                      onChange={(e) => setFormData({ ...formData, recordInvoice: e.target.checked })}
                      className="size-4 rounded border-[#2E2B24] bg-[#0E0D0B] text-[#B8962E] focus:ring-[#B8962E] accent-[#B8962E] cursor-pointer"
                    />
                    <label htmlFor="recordInvoice" className="text-sm font-semibold text-[#A89F8C] cursor-pointer select-none">
                      Record payment & generate membership invoice
                    </label>
                  </div>
                </div>
              )}

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
                  Save Profile
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

      {detailModalOpen && selectedCustomerForDetail && (
        <CustomerDetailModal
          customer={selectedCustomerForDetail}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedCustomerForDetail(null);
          }}
        />
      )}
    </div>
  );
}
