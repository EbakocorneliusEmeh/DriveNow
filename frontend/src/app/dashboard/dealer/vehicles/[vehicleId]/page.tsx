"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/vehicles`;

type VehicleForm = {
  make: string;
  model: string;
  year: number;
  dailyRate: number;
  location: string;
  description: string;
  imageUrls: string[];
};

type Vehicle = Omit<VehicleForm, "imageUrlsText"> & {
  id: string;
  status: "draft" | "published";
};

type VehicleResponse = {
  success: boolean;
  message?: string;
  data?: { vehicle: Vehicle };
};

type SelectedPhoto = {
  file: File;
  previewUrl: string;
};

const emptyVehicle: VehicleForm = {
  make: "",
  model: "",
  year: new Date().getFullYear(),
  dailyRate: 0,
  location: "",
  description: "",
  imageUrls: [],
};

export default function VehicleEditorPage() {
  const params = useParams<{ vehicleId: string }>();
  const vehicleId = params.vehicleId;
  const isNew = vehicleId === "new";
  const { role, isLoading } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<VehicleForm>(emptyVehicle);
  const [loadingVehicle, setLoadingVehicle] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const selectedPhotosRef = useRef<SelectedPhoto[]>([]);
  const [savedVehicleId, setSavedVehicleId] = useState<string | null>(null);

  useEffect(() => {
    return () => selectedPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
  }, []);

  function replaceSelectedPhotos(photos: SelectedPhoto[]) {
    selectedPhotosRef.current = photos;
    setSelectedPhotos(photos);
  }

  useEffect(() => {
    if (!isLoading && role !== "dealer") {
      router.replace(role ? "/dashboard" : "/login");
    }
  }, [isLoading, role, router]);

  useEffect(() => {
    if (isLoading || role !== "dealer" || isNew) return;

    async function loadVehicle() {
      const token = sessionStorage.getItem("drivenow_access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json() as { success: boolean; message?: string; data?: { vehicles: Vehicle[] } };
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message ?? "Unable to load vehicle listing.");
        }
        const vehicle = result.data.vehicles.find((item) => item.id === vehicleId);
        if (!vehicle) throw new Error("Vehicle listing not found.");
        setForm({
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          dailyRate: vehicle.dailyRate,
          location: vehicle.location,
          description: vehicle.description,
          imageUrls: vehicle.imageUrls,
        });
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load vehicle listing.");
      } finally {
        setLoadingVehicle(false);
      }
    }

    void loadVehicle();
  }, [isLoading, isNew, role, router, vehicleId]);

  function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const photos = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (form.imageUrls.length + selectedPhotos.length + photos.length > 10) {
      setError("You can add up to 10 photos for each vehicle.");
      return;
    }
    const invalidPhoto = photos.find((photo) => !["image/jpeg", "image/png", "image/webp"].includes(photo.type));
    if (invalidPhoto) {
      setError("Choose JPEG, PNG, or WebP photos.");
      return;
    }
    const oversizedPhoto = photos.find((photo) => photo.size > 5 * 1024 * 1024);
    if (oversizedPhoto) {
      setError("Each photo must be smaller than 5 MB.");
      return;
    }
    setError("");
    replaceSelectedPhotos([
      ...selectedPhotosRef.current,
      ...photos.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const currentVehicleId = savedVehicleId ?? (isNew ? null : vehicleId);
      const response = await fetch(currentVehicleId ? `${API_URL}/${currentVehicleId}` : API_URL, {
        method: currentVehicleId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          make: form.make,
          model: form.model,
          year: Number(form.year),
          dailyRate: Number(form.dailyRate),
          location: form.location,
          description: form.description,
          imageUrls: form.imageUrls,
        }),
      });
      const result = await response.json() as VehicleResponse;
      if (!response.ok || !result.success || !result.data?.vehicle) {
        throw new Error(result.message ?? "Unable to save vehicle listing.");
      }
      const targetVehicleId = result.data.vehicle.id;
      setSavedVehicleId(targetVehicleId);

      while (selectedPhotosRef.current.length > 0) {
        const photo = selectedPhotosRef.current[0];
        const uploadResponse = await fetch(`${API_URL}/${targetVehicleId}/images`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": photo.file.type,
          },
          body: photo.file,
        });
        const uploadResult = await uploadResponse.json() as VehicleResponse;
        if (!uploadResponse.ok || !uploadResult.success || !uploadResult.data?.vehicle) {
          throw new Error(uploadResult.message ?? `Unable to upload ${photo.file.name}.`);
        }
        setForm((current) => ({ ...current, imageUrls: uploadResult.data?.vehicle.imageUrls ?? current.imageUrls }));
        URL.revokeObjectURL(photo.previewUrl);
        replaceSelectedPhotos(selectedPhotosRef.current.slice(1));
      }

      router.push("/dashboard/dealer");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save vehicle listing.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || role !== "dealer" || loadingVehicle) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f1eb] px-5 text-center text-sm text-[#68756f]">
        <p role="status">{isLoading || loadingVehicle ? "Loading vehicle listing…" : "Taking you to the right page…"}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] px-5 py-8 text-[#18211f] sm:px-10 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-[-0.06em] text-[#123b35]">
            Drive<span className="text-[#d9a441]">Now</span>
          </Link>
          <Link href="/dashboard/dealer" className="rounded-full border border-[#d6dcd5] bg-[#fffdf9] px-4 py-2 text-sm font-semibold text-[#245c4c]">
            Back to inventory
          </Link>
        </nav>

        <header className="mt-8 rounded-3xl bg-[#123b35] px-7 py-8 text-[#f4f1eb] sm:px-9 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d9a441]">Vehicle inventory</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em]">{isNew ? "Add a vehicle" : "Edit vehicle"}</h1>
          <p className="mt-3 text-sm leading-6 text-[#b8ccc5]">Add accurate details so customers know what your vehicle offers.</p>
        </header>

        <form onSubmit={submit} className="mt-7 space-y-6 rounded-3xl border border-[#e2ded5] bg-[#fffdf9] p-6 shadow-sm sm:p-9">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-[#123b35]">
              Make
              <input value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} required minLength={2} maxLength={80} className="field mt-2" placeholder="Toyota" />
            </label>
            <label className="text-sm font-semibold text-[#123b35]">
              Model
              <input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} required maxLength={100} className="field mt-2" placeholder="Corolla" />
            </label>
            <label className="text-sm font-semibold text-[#123b35]">
              Year
              <input value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })} required type="number" min={1950} max={new Date().getFullYear() + 1} className="field mt-2" />
            </label>
            <label className="text-sm font-semibold text-[#123b35]">
              Daily rate (FCFA)
              <input value={form.dailyRate || ""} onChange={(event) => setForm({ ...form, dailyRate: Number(event.target.value) })} required type="number" min={1} step={1} className="field mt-2" placeholder="25000" />
            </label>
            <label className="text-sm font-semibold text-[#123b35] sm:col-span-2">
              Location
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} required minLength={2} maxLength={200} className="field mt-2" placeholder="Douala, Cameroon" />
            </label>
            <label className="text-sm font-semibold text-[#123b35] sm:col-span-2">
              Description
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required minLength={10} maxLength={2000} className="field mt-2 min-h-32 resize-y" placeholder="Describe the vehicle, its condition, and key features." />
            </label>
          </div>

          <section aria-labelledby="vehicle-photos-heading" className="border-t border-[#e9e5dc] pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="vehicle-photos-heading" className="text-base font-semibold text-[#123b35]">Vehicle photos</h2>
                <p className="mt-1 text-sm text-[#68756f]">Select multiple pictures from your phone or computer—show the front, sides, interior, and details.</p>
              </div>
              <label className="inline-flex cursor-pointer justify-center rounded-xl bg-[#123b35] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#245c4c]">
                Choose photos
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={choosePhotos} disabled={saving} className="sr-only" />
              </label>
            </div>
            <p className="mt-2 text-xs text-[#87928c]">Up to 10 photos total. JPEG, PNG, or WebP, max 5 MB each.</p>
            {(form.imageUrls.length > 0 || selectedPhotos.length > 0) ? (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {form.imageUrls.map((url, index) => (
                  <div key={`${url}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#f4f1eb]">
                    <Image src={url} alt={`Vehicle photo ${index + 1}`} fill unoptimized className="object-cover" />
                    <button type="button" onClick={() => setForm({ ...form, imageUrls: form.imageUrls.filter((_, photoIndex) => photoIndex !== index) })} className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-bold text-white" aria-label={`Remove vehicle photo ${index + 1}`}>Remove</button>
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-white">Saved</span>
                  </div>
                ))}
                {selectedPhotos.map((photo, index) => (
                  <div key={`${photo.file.name}-${photo.file.lastModified}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#f4f1eb]">
                    <Image src={photo.previewUrl} alt={`New vehicle photo ${index + 1}`} fill unoptimized className="object-cover" />
                    <button type="button" onClick={() => {
                      URL.revokeObjectURL(photo.previewUrl);
                      replaceSelectedPhotos(selectedPhotosRef.current.filter((_, photoIndex) => photoIndex !== index));
                    }} className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-bold text-white" aria-label={`Remove selected photo ${index + 1}`}>Remove</button>
                    <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold text-white">Selected · {photo.file.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-[#d6dcd5] bg-[#f4f1eb]/60 px-5 py-8 text-center text-sm text-[#68756f]">
                No photos selected yet.
              </div>
            )}
          </section>

          {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
          <p className="text-xs leading-5 text-[#68756f]">New listings are saved as drafts. Only approved dealers can publish them to the marketplace.</p>

          <div className="flex flex-col-reverse gap-3 border-t border-[#e9e5dc] pt-6 sm:flex-row sm:justify-end">
            <Link href="/dashboard/dealer" className="rounded-xl border border-[#d6dcd5] px-5 py-3 text-center text-sm font-semibold text-[#245c4c]">Cancel</Link>
            <button type="submit" disabled={saving} className="rounded-xl bg-[#d9a441] px-6 py-3 text-sm font-bold text-[#18211f] transition hover:bg-[#e7b95b] disabled:opacity-60">
              {saving ? "Saving…" : isNew ? "Save as draft" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
