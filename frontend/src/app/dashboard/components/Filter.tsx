"use client";

import type { ChangeEvent } from "react";

type FilterProps = {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => void;
  options?: readonly string[];
  type?: "text" | "number" | "select";
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
};

export default function Filter({
  label,
  value,
  onChange,
  options,
  type = "select",
  min,
  max,
  step,
  placeholder,
}: FilterProps) {
  const commonProps = {
    className:
      "rounded-xl border border-[#d6dcd5] bg-white px-3 py-2.5 text-sm font-medium text-[#18211f] focus:border-[#245c4c] focus:outline-none focus:ring-2 focus:ring-[#245c4c]/20",
    value,
    onChange,
  };

  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#68756f]">
      {label}
      {type === "select" ? (
        <select {...commonProps}>
          <option value="">Any</option>
          {options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...commonProps}
          type={type}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}