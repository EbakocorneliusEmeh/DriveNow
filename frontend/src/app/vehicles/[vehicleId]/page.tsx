"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/vehicles`;
const API_ROOT = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type Vehicle = {
  id: string;
  make: string;
  model: string;
  year: number;
  dailyRate: number;
  location: string;
  description: string;
  imageUrls: string[];
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessAddress: string;
  dealerLogoUrl: string | null;
  vehicleType?: "sedan" | "suv" | "truck" | "van" | "coupe" | "convertible";
  transmission?: "automatic" | "manual";
  fuelType?: "gasoline" | "diesel" | "electric" | "hybrid";
  seatingCapacity?: number;
};

type VehicleResponse = {
  success: boolean;
  message?: string;
  data?: { vehicle: Vehicle };
};

type BookingConfirmation = {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  estimatedTotal: number;
  status: "pending" | "confirmed";
};

function isDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsedDate = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
}

export default function VehicleDetailsPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [bookingConfirmation, setBookingConfirmation] = useState<BookingConfirmation | null>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  useEffect(() => {
    async function loadVehicle() {
      try {
        const response = await fetch(`${API_URL}/public/${vehicleId}`);
        const result = await response.json() as VehicleResponse;
        if (!response.ok || !result.success || !result.data?.vehicle) {
          throw new Error(result.message ?? "Unable to load this vehicle.");
        }
        setVehicle(result.data.vehicle);
        const searchParams = new URLSearchParams(window.location.search);
        const requestedPickupDate = searchParams.get("pickupDate");
        const requestedReturnDate = searchParams.get("returnDate");
        if (
          isDateOnly(requestedPickupDate)
          && isDateOnly(requestedReturnDate)
          && requestedReturnDate > requestedPickupDate
        ) {
          setStartDate(requestedPickupDate);
          setEndDate(requestedReturnDate);
        }
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load this vehicle.");
      } finally {
        setLoading(false);
      }
    }

    void loadVehicle();
  }, [vehicleId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f1eb] px-5 text-sm text-[#68756f]">
        <p role="status">Loading vehicle details…</p>
      </main>
    );
  }

  if (error || !vehicle) {
    return (
      <main className="min-h-screen bg-[#f4f1eb] px-5 py-12">
        <div className="mx-auto max-w-xl rounded-3xl bg-[#fffdf9] p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-[#123b35]">Vehicle unavailable</h1>
          <p role="alert" className="mt-3 text-sm text-[#68756f]">{error || "This vehicle listing could not be found."}</p>
          <Link href="/dashboard#vehicles" className="mt-6 inline-flex rounded-xl bg-[#123b35] px-5 py-3 text-sm font-bold text-white">
            Back to vehicles
          </Link>
        </div>
      </main>
    );
  }

  const activeImage = vehicle.imageUrls[selectedImage] ?? vehicle.imageUrls[0];
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const rentalDays = startDate && endDate
    ? Math.max(0, (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000)
    : 0;

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBookingError("");
    setBookingConfirmation(null);

    const token = sessionStorage.getItem("drivenow_access_token");
    if (!token) {
      setBookingError("Sign in to send a rental request.");
      return;
    }

    setIsSubmittingBooking(true);
    try {
      const response = await fetch(`${API_ROOT}/bookings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vehicleId, startDate, endDate, message }),
      });
      const result = await response.json() as {
        success: boolean;
        message?: string;
        data?: { booking: BookingConfirmation };
      };
      if (!response.ok || !result.success || !result.data?.booking) {
        throw new Error(result.message ?? "Unable to send your rental request.");
      }
      setBookingConfirmation(result.data.booking);
      setStartDate("");
      setEndDate("");
      setMessage("");
    } catch (caughtError) {
      setBookingError(caughtError instanceof Error ? caughtError.message : "Unable to send your rental request.");
    } finally {
      setIsSubmittingBooking(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] px-5 py-8 text-[#18211f] sm:px-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-[-0.06em] text-[#123b35]">
            Drive<span className="text-[#d9a441]">Now</span>
          </Link>
          <Link href="/dashboard#vehicles" className="rounded-full border border-[#d6dcd5] bg-[#fffdf9] px-4 py-2 text-sm font-semibold text-[#245c4c] transition hover:bg-[#e9eee7]">
            Back to vehicles
          </Link>
        </nav>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="overflow-hidden rounded-3xl border border-[#e2ded5] bg-[#fffdf9] shadow-sm">
            <div className="relative flex h-72 items-center justify-center bg-[#e9eee7] sm:h-[28rem]">
              {activeImage ? (
                <Image
                  src={activeImage}
                  alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}, photo ${selectedImage + 1}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <span className="text-sm text-[#87928c]">No vehicle photos available</span>
              )}
              {vehicle.imageUrls.length > 0 && (
                <span className="absolute bottom-4 right-4 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">
                  {selectedImage + 1} of {vehicle.imageUrls.length}
                </span>
              )}
            </div>
            {vehicle.imageUrls.length > 1 && (
              <div className="flex gap-3 overflow-x-auto border-t border-[#e9e5dc] p-4">
                {vehicle.imageUrls.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    aria-label={`Show vehicle photo ${index + 1}`}
                    aria-pressed={selectedImage === index}
                    className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border-2 ${selectedImage === index ? "border-[#d9a441]" : "border-transparent"}`}
                  >
                    <Image src={image} alt="" fill unoptimized className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="h-fit rounded-3xl border border-[#e2ded5] bg-[#fffdf9] p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c28d27]">Vehicle details</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#123b35]">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h1>
            <p className="mt-2 text-sm text-[#68756f]">{vehicle.location}</p>
            <p className="mt-6 border-y border-[#e9e5dc] py-5 text-2xl font-bold text-[#123b35]">
              {vehicle.dailyRate.toLocaleString()} FCFA
              <span className="ml-1 text-sm font-normal text-[#68756f]">per day</span>
            </p>

            <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-[#123b35]">About this vehicle</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#68756f]">{vehicle.description}</p>

            <div className="mt-7 border-t border-[#e9e5dc] pt-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[#123b35]">Dealer</h2>
              <div className="mt-4 flex items-center gap-3">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e9eee7] text-lg font-bold text-[#245c4c]">
                  {vehicle.dealerLogoUrl ? (
                    <Image src={vehicle.dealerLogoUrl} alt="" fill unoptimized className="object-cover" />
                  ) : (
                    vehicle.businessName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-semibold text-[#123b35]">{vehicle.businessName}</p>
                  <p className="mt-1 text-xs text-[#68756f]">{vehicle.businessAddress}</p>
                </div>
              </div>
              <a href={`tel:${vehicle.businessPhone}`} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#123b35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#245c4c]">
                Contact dealer
              </a>
              <a href={`mailto:${vehicle.businessEmail}`} className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[#d6dcd5] px-5 py-3 text-sm font-semibold text-[#245c4c] transition hover:bg-[#f4f1eb]">
                Email dealer
              </a>
            </div>
          </aside>
        </div>

        <section id="rent" className="mt-8 scroll-mt-8 rounded-3xl border border-[#e2ded5] bg-[#fffdf9] p-6 shadow-sm sm:p-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c28d27]">Request this car</p>
            <h2 className="mt-2 text-2xl font-bold text-[#123b35]">Choose your rental dates</h2>
            <p className="mt-2 text-sm leading-6 text-[#68756f]">
              Sending a request does not confirm your booking. The dealer will review it and respond.
            </p>
            {user?.role === "customer" ? (
              <form onSubmit={submitBooking} className="mt-6 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-[#123b35]">
                    Pickup date
                    <input
                      type="date"
                      required
                      min={minDate}
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="mt-2 block w-full rounded-xl border border-[#d6dcd5] bg-white px-4 py-3 text-sm font-normal text-[#18211f] focus:border-[#245c4c] focus:outline-none focus:ring-2 focus:ring-[#245c4c]/20"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[#123b35]">
                    Return date
                    <input
                      type="date"
                      required
                      min={startDate || minDate}
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className="mt-2 block w-full rounded-xl border border-[#d6dcd5] bg-white px-4 py-3 text-sm font-normal text-[#18211f] focus:border-[#245c4c] focus:outline-none focus:ring-2 focus:ring-[#245c4c]/20"
                    />
                  </label>
                </div>
                <label className="block text-sm font-semibold text-[#123b35]">
                  Message to dealer <span className="font-normal text-[#87928c]">(optional)</span>
                  <textarea
                    maxLength={1000}
                    rows={3}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Share any details about your rental request."
                    className="mt-2 block w-full resize-y rounded-xl border border-[#d6dcd5] bg-white px-4 py-3 text-sm font-normal text-[#18211f] focus:border-[#245c4c] focus:outline-none focus:ring-2 focus:ring-[#245c4c]/20"
                  />
                </label>
                {rentalDays > 0 && (
                  <p className="text-sm font-semibold text-[#123b35]">
                    Estimated total: {(rentalDays * vehicle.dailyRate).toLocaleString()} FCFA
                    <span className="ml-1 font-normal text-[#68756f]">({rentalDays} {rentalDays === 1 ? "day" : "days"}; additional fees may apply)</span>
                  </p>
                )}
                {bookingError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{bookingError}</p>}
                {bookingConfirmation && (
                  <div role="status" className="rounded-xl border border-[#b8d7c0] bg-[#e6f2e8] p-4 text-sm leading-6 text-[#245c4c]">
                    <p className="font-bold">
                      {bookingConfirmation.status === "pending" ? "Request sent to the dealer" : "Booking confirmed"}
                    </p>
                    <p className="mt-1">
                      {bookingConfirmation.startDate} to {bookingConfirmation.endDate} · {bookingConfirmation.totalDays} {bookingConfirmation.totalDays === 1 ? "day" : "days"} · Estimated total {bookingConfirmation.estimatedTotal.toLocaleString()} FCFA
                    </p>
                    <p className="mt-2">
                      {bookingConfirmation.status === "pending"
                        ? "Your rental is not confirmed until the dealer responds."
                        : "Your rental is confirmed."}{" "}
                      <Link href="/dashboard/bookings" className="font-bold underline">
                        View your bookings
                      </Link>
                      .
                    </p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmittingBooking || !startDate || !endDate || rentalDays < 1}
                  className="inline-flex items-center justify-center rounded-xl bg-[#123b35] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#245c4c] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingBooking ? "Sending request…" : "Send rental request"}
                </button>
              </form>
            ) : isAuthLoading ? (
              <p role="status" className="mt-5 text-sm text-[#68756f]">Checking your account…</p>
            ) : user ? (
              <p className="mt-5 rounded-xl bg-[#f4f1eb] p-4 text-sm text-[#68756f]">Rental requests are available to customer accounts.</p>
            ) : (
              <Link href="/login" className="mt-5 inline-flex rounded-xl bg-[#123b35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#245c4c]">
                Sign in to rent now
              </Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}