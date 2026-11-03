"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import VehiclePhotoGallery from "@/components/VehiclePhotoGallery";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/vehicles`;

type Vehicle = {
  id: string;
  make: string;
  model: string;
  year: number;
  dailyRate: number;
  location: string;
  description: string;
  imageUrls: string[];
  status: "draft" | "published";
};

type VehiclesResponse = {
  success: boolean;
  message?: string;
  data?: { vehicles: Vehicle[] };
};

export default function VehicleList() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadVehicles = useCallback(async () => {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      setError("Please sign in again to view your inventory.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json()) as VehiclesResponse;
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message ?? "Unable to load vehicle inventory.");
      }
      setVehicles(result.data.vehicles);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load vehicle inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadVehicles);
  }, [loadVehicles]);

  async function changeStatus(vehicle: Vehicle) {
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) return;
    setError("");

    try {
      const status = vehicle.status === "published" ? "draft" : "published";
      const response = await fetch(`${API_URL}/${vehicle.id}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to update listing status.");
      }
      await loadVehicles();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update listing status.");
    }
  }

  async function removeVehicle(vehicle: Vehicle) {
    if (!window.confirm(`Delete ${vehicle.year} ${vehicle.make} ${vehicle.model}?`)) return;
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) return;
    setError("");

    try {
      const response = await fetch(`${API_URL}/${vehicle.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json()) as { success: boolean; message?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to delete vehicle listing.");
      }
      setVehicles((current) => current.filter((item) => item.id !== vehicle.id));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to delete vehicle listing.");
    }
  }

  return (
    <section
      aria-labelledby="inventory-heading"
      className="mt-8 overflow-hidden rounded-3xl border border-[#e2ded5] bg-[#fffdf9] shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-[#e9e5dc] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <h2 id="inventory-heading" className="text-lg font-semibold tracking-tight text-[#123b35]">
            Vehicle inventory
          </h2>
          <p className="mt-1 text-sm text-[#68756f]">Manage the vehicles your customers can book.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[#e9eee7] px-3 py-1 text-xs font-semibold text-[#245c4c]">
            {vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"}
          </span>
          <Link href="/dashboard/dealer/vehicles/new" className="rounded-xl bg-[#d9a441] px-4 py-2.5 text-sm font-bold text-[#18211f] transition hover:bg-[#e7b95b]">
            Add vehicle
          </Link>
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {loading ? (
          <p role="status" className="py-12 text-center text-sm text-[#68756f]">Loading your inventory…</p>
        ) : vehicles.length === 0 ? (
          <div className="px-2 py-12 text-center sm:py-16">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f4f1eb] text-2xl text-[#245c4c]" aria-hidden="true">▱</div>
            <h3 className="mt-5 text-base font-semibold text-[#123b35]">Your inventory is clear</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#68756f]">
              Add your first vehicle to start building your listings. New vehicles begin as drafts until you publish them.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {vehicles.map((vehicle) => (
              <article key={vehicle.id} className="overflow-hidden rounded-2xl border border-[#e9e5dc]">
                <div className="relative">
                  <VehiclePhotoGallery imageUrls={vehicle.imageUrls} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} />
                  <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold capitalize ${vehicle.status === "published" ? "bg-[#e6f2e8] text-[#245c4c]" : "bg-[#fff3d6] text-[#76571b]"}`}>
                    {vehicle.status}
                  </span>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-[#123b35]">{vehicle.year} {vehicle.make} {vehicle.model}</h3>
                      <p className="mt-1 text-sm text-[#68756f]">{vehicle.location}</p>
                    </div>
                    <p className="shrink-0 text-right text-sm font-bold text-[#123b35]">
                      {vehicle.dailyRate.toLocaleString()} FCFA<span className="block text-xs font-normal text-[#87928c]">per day</span>
                    </p>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-5 text-[#68756f]">{vehicle.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-[#e9e5dc] pt-4">
                    <Link href={`/dashboard/dealer/vehicles/${vehicle.id}`} className="rounded-lg border border-[#d6dcd5] px-3 py-2 text-xs font-semibold text-[#245c4c] hover:bg-[#f4f1eb]">
                      Edit
                    </Link>
                    <button type="button" onClick={() => void changeStatus(vehicle)} className="rounded-lg bg-[#123b35] px-3 py-2 text-xs font-semibold text-white hover:bg-[#245c4c]">
                      {vehicle.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                    <button type="button" onClick={() => void removeVehicle(vehicle)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
