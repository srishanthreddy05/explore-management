"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { formatCurrency } from "@/components/salon-dashboard/types";
import { useAppData } from "@/context/AppDataContext";
import * as mappingsService from "@/services/serviceProductMappings";
import type { ServiceProductMapping } from "@/services/serviceProductMappings";

export function ServiceProductMappings() {
  const { services, loadingAppData } = useAppData();
  const [mappings, setMappings] = useState<ServiceProductMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ServiceProductMapping | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [productName, setProductName] = useState("");
  const [usageCost, setUsageCost] = useState("");

  const loadMappings = async () => {
    const data = await mappingsService.getAll();
    setMappings(data);
  };

  useEffect(() => {
    if (loadingAppData) return;
    let active = true;
    (async () => {
      try {
        const data = await mappingsService.seedDefaultMappings(services);
        if (active) setMappings(data);
      } catch (error) {
        console.error("Failed to load service product mappings:", error);
        if (active) toast.error("Could not load service product mappings.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [services, loadingAppData]);

  const mappedServiceIds = useMemo(
    () => new Set(mappings.map((mapping) => mapping.serviceId)),
    [mappings]
  );
  const availableServices = services.filter(
    (service) => service.id && (!mappedServiceIds.has(service.id) || service.id === editing?.serviceId)
  );

  const openAdd = () => {
    setEditing(null);
    setServiceId("");
    setProductName("");
    setUsageCost("");
    setModalOpen(true);
  };

  const openEdit = (mapping: ServiceProductMapping) => {
    setEditing(mapping);
    setServiceId(mapping.serviceId);
    setProductName(mapping.productName);
    setUsageCost(String(mapping.usageCost));
    setModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const selectedService = services.find((service) => service.id === serviceId);
    if (!selectedService) {
      toast.error("Please select a service.");
      return;
    }
    if (!productName.trim()) {
      toast.error("Please enter a product name.");
      return;
    }
    const cost = Number(usageCost);
    if (!Number.isFinite(cost) || cost < 0 || usageCost.trim() === "") {
      toast.error("Please enter a valid usage cost.");
      return;
    }

    try {
      setSaving(true);
      await mappingsService.save({
        serviceId: selectedService.id!,
        serviceName: selectedService.name,
        productName: productName.trim(),
        usageCost: cost,
      });
      await loadMappings();
      setModalOpen(false);
      toast.success(editing ? "Service product updated." : "Service product saved.");
    } catch (error: any) {
      toast.error(error?.message || "Could not save service product.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (mapping: ServiceProductMapping) => {
    if (!window.confirm(`Remove the product mapping for ${mapping.serviceName}?`)) return;
    try {
      await mappingsService.remove(mapping.serviceId);
      await loadMappings();
      toast.success("Service product mapping removed.");
    } catch (error) {
      console.error(error);
      toast.error("Could not remove service product mapping.");
    }
  };

  return (
    <section className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2E2B24] pb-2">
        <div>
          <h2 className="text-lg font-bold text-[#F5F0E8]">Products Used ({mappings.length})</h2>
          <p className="mt-0.5 text-xs text-[#6B6358]">
            Configure the product and usage cost for each service. Billing attaches it automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          disabled={availableServices.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-xs font-semibold text-[#A89F8C] transition hover:border-[#B8962E] hover:bg-[#1F1A0F] hover:text-[#B8962E] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={15} /> New
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#131210]">
        <table className="w-full min-w-[650px] border-collapse text-left text-sm text-[#A89F8C]">
          <thead className="border-b border-[#2E2B24] bg-[#0E0D0B] text-[10px] font-bold uppercase tracking-[0.18em]">
            <tr>
              <th className="px-5 py-4">Service</th>
              <th className="px-5 py-4">Product Name</th>
              <th className="px-5 py-4">Usage Cost</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2E2B24]">
            {loading ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-[#6B6358]">Loading mappings…</td></tr>
            ) : mappings.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-[#6B6358]">No product mappings yet. Select New to add one.</td></tr>
            ) : mappings.map((mapping) => (
              <tr key={mapping.id || mapping.serviceId} className="hover:bg-[#1C1A16]">
                <td className="px-5 py-4 font-semibold text-[#F5F0E8]">{mapping.serviceName}</td>
                <td className="px-5 py-4">{mapping.productName}</td>
                <td className="px-5 py-4 font-semibold text-[#F5F0E8]">{formatCurrency(mapping.usageCost)}</td>
                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => openEdit(mapping)} className="grid size-9 place-items-center rounded-xl border border-[#2E2B24] text-[#B8962E] hover:border-[#B8962E]" title="Edit mapping">
                      <Edit2 size={14} />
                    </button>
                    <button type="button" onClick={() => handleRemove(mapping)} className="grid size-9 place-items-center rounded-xl border border-[#5C2424] text-[#E57373] hover:border-[#E57373]" title="Remove mapping">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button type="button" aria-label="Close modal" className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={() => !saving && setModalOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-3xl border border-[#2E2B24] bg-[#1C1A16] p-6 text-[#A89F8C] shadow-2xl">
            <button type="button" onClick={() => !saving && setModalOpen(false)} className="absolute right-5 top-5 text-[#A89F8C] hover:text-[#B8962E]"><X size={20}/></button>
            <h3 className="mb-1 text-xl font-bold text-[#F5F0E8]">{editing ? "Edit Product Used" : "New Product Used"}</h3>
            <p className="mb-5 text-xs text-[#6B6358]">Link one product and its cost to a service.</p>
            <form onSubmit={handleSave} className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold">Select Service</span>
                <select required value={serviceId} onChange={(event) => setServiceId(event.target.value)} disabled={!!editing} className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-3 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E]">
                  <option value="">Choose a service</option>
                  {availableServices.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Product Name</span>
                <input required value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Enter product name" className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-3 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E]" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Usage Cost (₹)</span>
                <input required type="number" min="0" step="0.01" value={usageCost} onChange={(event) => setUsageCost(event.target.value)} placeholder="Enter cost per service" className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-3 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E]" />
              </label>
              <div className="flex justify-end gap-3 border-t border-[#2E2B24] pt-4">
                <button type="button" disabled={saving} onClick={() => setModalOpen(false)} className="h-10 rounded-xl border border-[#2E2B24] px-4 text-sm font-semibold hover:border-[#B8962E]">Cancel</button>
                <button type="submit" disabled={saving} className="h-10 rounded-xl bg-[#B8962E] px-5 text-sm font-bold text-[#0E0D0B] disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
