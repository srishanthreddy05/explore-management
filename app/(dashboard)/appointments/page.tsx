"use client";

import { useEffect, useState } from "react";
import * as appointmentsService from "@/services/appointments";
import * as staffService from "@/services/staff";
import * as servicesService from "@/services/services";
import type { Appointment } from "@/types/appointment";
import type { Staff } from "@/types/staff";
import type { Service } from "@/types/service";
import { Plus, Search, Edit2, Trash2, X, CalendarDays } from "lucide-react";
import { format } from "date-fns";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState({
    customerName: "",
    customerMobile: "",
    dateTime: "",
    services: [] as string[],
    staffName: "",
    status: "Scheduled",
    notes: "",
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const appts = await appointmentsService.getAll();
      setAppointments(appts);
      
      const staff = await staffService.getAll();
      setStaffList(staff.filter((s) => s.status === "Active"));

      const services = await servicesService.getAll();
      setServicesList(services);
    } catch (error) {
      console.error("Failed to load appointments data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingAppointment(null);
    setFormData({
      customerName: "",
      customerMobile: "",
      dateTime: "",
      services: [],
      staffName: staffList[0]?.name || "",
      status: "Scheduled",
      notes: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (appt: Appointment) => {
    setEditingAppointment(appt);
    setFormData({
      customerName: appt.customerName,
      customerMobile: appt.customerMobile,
      dateTime: appt.dateTime,
      services: appt.services,
      staffName: appt.staffName,
      status: appt.status,
      notes: appt.notes || "",
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
      await appointmentsService.delete(idToDelete);
      setDeleteConfirmOpen(false);
      setIdToDelete(null);
      loadData();
    } catch (error) {
      console.error("Failed to delete appointment:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.services.length === 0) {
      alert("Please select at least one service.");
      return;
    }
    if (!formData.staffName) {
      alert("Please assign a staff member.");
      return;
    }
    try {
      if (editingAppointment?.id) {
        await appointmentsService.update(editingAppointment.id, formData);
      } else {
        await appointmentsService.create(formData);
      }
      setModalOpen(false);
      loadData();
    } catch (error) {
      console.error("Failed to save appointment:", error);
    }
  };

  const handleServiceCheckboxChange = (serviceName: string) => {
    setFormData((prev) => {
      const selected = prev.services.includes(serviceName)
        ? prev.services.filter((s) => s !== serviceName)
        : [...prev.services, serviceName];
      return { ...prev, services: selected };
    });
  };

  const filteredAppointments = appointments.filter(
    (a) =>
      a.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.customerMobile.includes(searchQuery) ||
      a.staffName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full text-stone-900">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-stone-500">
            Bookings
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            Appointments
          </h1>
        </div>
        {!loading && appointments.length > 0 && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-850"
          >
            <Plus size={18} />
            Book Appointment
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
        </div>
      ) : appointments.length === 0 ? (
        // Empty State UI
        <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-md">
          <div className="grid size-16 place-items-center rounded-2xl bg-stone-100 text-stone-900 mb-4">
            <CalendarDays size={32} />
          </div>
          <h2 className="text-xl font-bold text-stone-900">No Appointments Found</h2>
          <p className="mt-2 max-w-sm text-sm text-stone-500">
            Book stylings, manage schedules, and keep staff bookings organized in real-time.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-850"
          >
            <Plus size={18} />
            Book Appointment
          </button>
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="mb-4 flex max-w-md items-center rounded-2xl border border-stone-200 bg-white px-4 h-12 shadow-sm focus-within:border-black">
            <Search size={18} className="text-stone-400 mr-2" />
            <input
              type="text"
              placeholder="Search by client, phone, or staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
            />
          </div>

          {/* List display */}
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-md">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm text-stone-600">
              <thead className="bg-stone-55 text-xs uppercase tracking-[0.2em] text-stone-550 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-4 font-bold">Client</th>
                  <th className="px-6 py-4 font-bold">Phone</th>
                  <th className="px-6 py-4 font-bold">Date & Time</th>
                  <th className="px-6 py-4 font-bold">Services</th>
                  <th className="px-6 py-4 font-bold">Stylist</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredAppointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-stone-50 transition bg-white text-stone-900">
                    <td className="px-6 py-4 font-semibold text-stone-900">{appt.customerName}</td>
                    <td className="px-6 py-4 font-medium">{appt.customerMobile}</td>
                    <td className="px-6 py-4">
                      {appt.dateTime ? format(new Date(appt.dateTime), "Pp") : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {appt.services.map((srv) => (
                          <span
                            key={srv}
                            className="rounded bg-stone-105 border border-stone-200 px-2 py-0.5 text-xs text-stone-700 font-semibold"
                          >
                            {srv}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-stone-800">{appt.staffName}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                          appt.status === "Completed"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : appt.status === "Cancelled"
                              ? "bg-red-100 text-red-800 border border-red-300"
                              : "bg-blue-100 text-blue-800 border border-blue-300"
                        }`}
                      >
                        {appt.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(appt)}
                          className="grid size-10 place-items-center rounded-xl border border-stone-200 text-stone-400 hover:text-black hover:border-black transition"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => appt.id && handleDeleteTrigger(appt.id)}
                          className="grid size-10 place-items-center rounded-xl border border-stone-200 text-stone-400 hover:text-red-650 hover:border-red-500 hover:bg-red-55 transition"
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
          <div className="relative w-full max-w-lg rounded-2xl border border-stone-250 bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh] text-stone-900">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-black"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-stone-900 mb-4">
              {editingAppointment ? "Edit Stylist Booking" : "Book Salon Stylist"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Client Name</span>
                  <input
                    required
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Client Mobile</span>
                  <input
                    required
                    type="text"
                    value={formData.customerMobile}
                    onChange={(e) => setFormData({ ...formData, customerMobile: e.target.value })}
                    className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Date & Time</span>
                  <input
                    required
                    type="datetime-local"
                    value={formData.dateTime}
                    onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
                    className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Assign Stylist</span>
                  <select
                    required
                    value={formData.staffName}
                    onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                    className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  >
                    <option value="" disabled>Select Stylist</option>
                    {staffList.map((stf) => (
                      <option key={stf.id} value={stf.name}>
                        {stf.name} ({stf.role})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Booking Status</span>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </label>

              <div className="block">
                <span className="text-sm font-semibold text-stone-700">Select Services</span>
                {servicesList.length === 0 ? (
                  <p className="text-xs text-amber-600 mt-2 font-semibold">
                    No services in catalog. Create services in catalog first.
                  </p>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 max-h-32 overflow-y-auto">
                    {servicesList.map((srv) => (
                      <label key={srv.id} className="flex items-center gap-2 text-stone-700 hover:text-stone-900 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formData.services.includes(srv.name)}
                          onChange={() => handleServiceCheckboxChange(srv.name)}
                          className="rounded border-stone-300 text-black focus:ring-black"
                        />
                        <span className="text-xs font-medium truncate">{srv.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Consultation Notes</span>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="mt-2 min-h-16 w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-900 outline-none transition focus:border-black"
                />
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
                  Save Appointment
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
