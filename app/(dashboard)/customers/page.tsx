"use client";

import { useEffect, useState } from "react";
import * as customerService from "@/services/customers";
import type { Customer } from "@/types/customer";
import { Plus, Search, Edit2, Trash2, X, Users } from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    customerType: "regular" as "regular" | "membership",
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await customerService.getAll();
      setCustomers(data);
    } catch (error) {
      console.error("Failed to load customers:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: "",
      phone: "",
      customerType: "regular",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || "",
      phone: customer.phone || "",
      customerType: customer.customerType || "regular",
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
      setDeleteConfirmOpen(false);
      setIdToDelete(null);
      loadCustomers();
    } catch (error) {
      console.error("Failed to delete customer:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCustomer?.id) {
        await customerService.update(editingCustomer.id, formData);
      } else {
        await customerService.create(formData);
      }
      setModalOpen(false);
      loadCustomers();
    } catch (error) {
      console.error("Failed to save customer:", error);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      c.phone.includes(debouncedQuery)
  );

  const regularCustomers = filteredCustomers.filter(
    (c) => c.customerType === "regular" || !c.customerType
  );

  const membershipCustomers = filteredCustomers.filter(
    (c) => c.customerType === "membership"
  );

  return (
    <div className="w-full text-stone-900">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-stone-500">
            CRM
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            Customers ({customers.length})
          </h1>
        </div>
        {!loading && customers.length > 0 && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-850"
          >
            <Plus size={18} />
            Add Customer
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
        </div>
      ) : customers.length === 0 ? (
        // Empty State UI
        <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-md">
          <div className="grid size-16 place-items-center rounded-2xl bg-stone-100 text-stone-900 mb-4">
            <Users size={32} />
          </div>
          <h2 className="text-xl font-bold text-stone-900">No Customers Found</h2>
          <p className="mt-2 max-w-sm text-sm text-stone-500">
            Create profiles to track salon memberships and schedule visits.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-850"
          >
            <Plus size={18} />
            Add Customer
          </button>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="mb-6 flex max-w-md items-center rounded-2xl border border-stone-200 bg-white px-4 h-12 shadow-sm focus-within:border-black">
            <Search size={18} className="text-stone-400 mr-2" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
            />
          </div>

          {/* List display: 2 columns side-by-side */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Regular Customers Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-150 pb-2">
                <h2 className="text-lg font-bold text-stone-900">
                  Regular Customers ({regularCustomers.length})
                </h2>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-md">
                <table className="w-full min-w-[340px] border-collapse text-left text-sm text-stone-600">
                  <thead className="bg-stone-50 text-xs uppercase tracking-[0.2em] text-stone-500 border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-3.5 font-bold">Name</th>
                      <th className="px-4 py-3.5 font-bold">Phone</th>
                      <th className="px-4 py-3.5 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {regularCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-stone-400 font-medium italic bg-white">
                          No regular customers.
                        </td>
                      </tr>
                    ) : (
                      regularCustomers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-stone-50 transition bg-white text-stone-900">
                          <td className="px-4 py-3 font-semibold text-stone-900">{customer.name}</td>
                          <td className="px-4 py-3 font-medium">{customer.phone}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEdit(customer)}
                                className="grid size-8 place-items-center rounded-lg border border-stone-200 text-stone-400 hover:text-black hover:border-black transition"
                                title="Edit"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => customer.id && handleDeleteTrigger(customer.id)}
                                className="grid size-8 place-items-center rounded-lg border border-stone-200 text-stone-400 hover:text-red-650 hover:border-red-500 hover:bg-red-50 transition"
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
            </div>

            {/* Membership Customers Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-150 pb-2">
                <h2 className="text-lg font-bold text-stone-900">
                  Membership Customers ({membershipCustomers.length})
                </h2>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-md">
                <table className="w-full min-w-[340px] border-collapse text-left text-sm text-stone-600">
                  <thead className="bg-stone-55 text-xs uppercase tracking-[0.2em] text-stone-550 border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-3.5 font-bold">Name</th>
                      <th className="px-4 py-3.5 font-bold">Phone</th>
                      <th className="px-4 py-3.5 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {membershipCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-stone-400 font-medium italic bg-white">
                          No membership customers.
                        </td>
                      </tr>
                    ) : (
                      membershipCustomers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-stone-50 transition bg-white text-stone-900">
                          <td className="px-4 py-3 font-semibold text-stone-900">{customer.name}</td>
                          <td className="px-4 py-3 font-medium">{customer.phone}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEdit(customer)}
                                className="grid size-8 place-items-center rounded-lg border border-stone-200 text-stone-400 hover:text-black hover:border-black transition"
                                title="Edit"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => customer.id && handleDeleteTrigger(customer.id)}
                                className="grid size-8 place-items-center rounded-lg border border-stone-200 text-stone-400 hover:text-red-650 hover:border-red-500 hover:bg-red-50 transition"
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
            </div>
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
              {editingCustomer ? "Edit Customer Details" : "Add Customer"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Name</span>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Phone Number</span>
                <input
                  required
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Customer Type</span>
                <select
                  value={formData.customerType}
                  onChange={(e) => setFormData({ ...formData, customerType: e.target.value as "regular" | "membership" })}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
                >
                  <option value="regular">Regular</option>
                  <option value="membership">Membership</option>
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
