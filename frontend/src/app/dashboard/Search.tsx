"use client";

import { useMemo, useState, type FormEvent, type ChangeEvent } from "react";
import Filter from "./components/Filter";

export type VehicleSearchCriteria = {
  query?: string;
  priceRange?: [number, number];
  vehicleType?: "sedan" | "suv" | "truck" | "van" | "coupe" | "convertible";
  transmission?: "automatic" | "manual";
  fuelType?: "gasoline" | "diesel" | "electric" | "hybrid";
  seatingCapacity?: number;
};

type SearchProps = {
  onSearch: (criteria: VehicleSearchCriteria) => Promise<void>;
};

const vehicleTypes = ["sedan", "suv", "truck", "van", "coupe", "convertible"] as const;
const transmissionTypes = ["automatic", "manual"] as const;
const fuelTypes = ["gasoline", "diesel", "electric", "hybrid"] as const;

export default function Search({ onSearch }: SearchProps) {
  const [searchCriteria, setSearchCriteria] = useState<VehicleSearchCriteria>({});
  const [isSearching, setIsSearching] = useState(false);

  const hasFilters = useMemo(() => {
    return Object.values(searchCriteria).some(Boolean);
  }, [searchCriteria]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSearching(true);
    try {
      const criteria: VehicleSearchCriteria = {};
      if (searchCriteria.query) criteria.query = searchCriteria.query.trim();
      if (searchCriteria.vehicleType) criteria.vehicleType = searchCriteria.vehicleType;
      if (searchCriteria.transmission) criteria.transmission = searchCriteria.transmission;
      if (searchCriteria.fuelType) criteria.fuelType = searchCriteria.fuelType;
      if (searchCriteria.seatingCapacity) criteria.seatingCapacity = Number(searchCriteria.seatingCapacity);
      if (searchCriteria.priceRange) criteria.priceRange = [0, Number(searchCriteria.priceRange)];

      await onSearch(Object.keys(criteria).length ? criteria : {});
    } finally {
      setIsSearching(false);
    }
  }

  function handleFilterChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setSearchCriteria((prev) => ({ ...prev, [name]: value }));
  }

  function clearFilters() {
    setSearchCriteria({});
    void onSearch({});
  }

  return (
    <form onSubmit={handleSearch} role="search" className="mt-8 rounded-[1.5rem] border border-[#e2ded5] bg-[#fffdf9] p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 md:flex-row">
        <label htmlFor="vehicleSearchQuery" className="sr-only">
          Search vehicles
        </label>
        <input
          id="vehicleSearchQuery"
          name="query"
          type="search"
          value={searchCriteria.query ?? ""}
          onChange={handleFilterChange}
          placeholder="Search vehicles by make, model, location, or keyword"
          className="min-w-0 flex-1 rounded-xl border border-[#d6dcd5] bg-[#fffdf9] px-4 py-3 text-sm text-[#18211f] placeholder:text-[#87928c] focus:border-[#245c4c] focus:outline-none focus:ring-2 focus:ring-[#245c4c]/20"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="rounded-xl bg-[#123b35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#245c4c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a441] disabled:cursor-wait disabled:opacity-60"
        >
          {isSearching ? "Searching…" : "Search"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Filter
          label="Vehicle type"
          value={searchCriteria.vehicleType ?? ""}
          onChange={handleFilterChange}
          options={vehicleTypes}
        />
        <Filter
          label="Transmission"
          value={searchCriteria.transmission ?? ""}
          onChange={handleFilterChange}
          options={transmissionTypes}
        />
        <Filter
          label="Fuel"
          value={searchCriteria.fuelType ?? ""}
          onChange={handleFilterChange}
          options={fuelTypes}
        />
        <Filter
          label="Min seats"
          value={searchCriteria.seatingCapacity?.toString() ?? ""}
          onChange={handleFilterChange}
          type="number"
          min={1}
          max={10}
          placeholder="4"
        />
        <Filter
          label="Max price"
          value={searchCriteria.priceRange?.[1].toString() ?? ""}
          onChange={handleFilterChange}
          type="number"
          min={1000}
          step={500}
          placeholder="50000"
        />
      </div>

      {hasFilters && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-bold text-[#245c4c] transition hover:text-[#123b35]"
          >
            Clear filters
          </button>
        </div>
      )}
    </form>
  );
}