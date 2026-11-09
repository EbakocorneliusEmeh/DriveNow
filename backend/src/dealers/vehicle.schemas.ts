import { z } from "zod";

const currentYear = new Date().getFullYear() + 1;

export const vehicleInputSchema = z.object({
  make: z.string().trim().min(2).max(80),
  model: z.string().trim().min(1).max(100),
  year: z.number().int().min(1950).max(currentYear),
  dailyRate: z.number().int().positive().max(10_000_000),
  location: z.string().trim().min(2).max(200),
  description: z.string().trim().min(10).max(2_000),
  imageUrls: z.array(z.url()).max(10),
  vehicleType: z.enum(["sedan", "suv", "truck", "van", "coupe", "convertible"]).optional(),
  transmission: z.enum(["automatic", "manual"]).optional(),
  fuelType: z.enum(["gasoline", "diesel", "electric", "hybrid"]).optional(),
  seatingCapacity: z.number().int().positive().max(10).optional(),
});

export const vehicleStatusSchema = z.object({
  status: z.enum(["draft", "published"]),
});

export const vehicleIdSchema = z.string().uuid();

export type VehicleInput = z.infer<typeof vehicleInputSchema>;

export const vehicleSearchSchema = z.object({
  query: z.string().trim().max(200).optional(),
  pickupDate: z.iso.date().optional(),
  returnDate: z.iso.date().optional(),
  priceRange: z.tuple([
    z.number().int().positive().max(10_000_000),
    z.number().int().positive().max(10_000_000),
  ]).optional(),
  vehicleType: z.enum(["sedan", "suv", "truck", "van", "coupe", "convertible"]).optional(),
  transmission: z.enum(["automatic", "manual"]).optional(),
  fuelType: z.enum(["gasoline", "diesel", "electric", "hybrid"]).optional(),
  seatingCapacity: z.number().int().positive().max(10).optional(),
}).superRefine((input, context) => {
  if (Boolean(input.pickupDate) !== Boolean(input.returnDate)) {
    context.addIssue({
      code: "custom",
      message: "Choose both a pickup date and a return date.",
      path: ["returnDate"],
    });
  }

  if (input.priceRange && input.priceRange[0] > input.priceRange[1]) {
    context.addIssue({
      code: "custom",
      message: "Minimum price cannot be greater than maximum price.",
      path: ["priceRange"],
    });
  }

  if (input.pickupDate && input.pickupDate < new Date().toISOString().slice(0, 10)) {
    context.addIssue({
      code: "custom",
      message: "Pickup date must be today or a future date.",
      path: ["pickupDate"],
    });
  }

  if (input.pickupDate && input.returnDate && input.returnDate <= input.pickupDate) {
    context.addIssue({
      code: "custom",
      message: "Return date must be after the pickup date.",
      path: ["returnDate"],
    });
  }
});

export type VehicleSearch = z.infer<typeof vehicleSearchSchema>;

export const availabilityBlockSchema = z.object({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
}).superRefine((input, context) => {
  if (input.startDate < new Date().toISOString().slice(0, 10)) {
    context.addIssue({
      code: "custom",
      message: "Unavailable dates must start today or later.",
      path: ["startDate"],
    });
  }
  if (input.endDate < input.startDate) {
    context.addIssue({
      code: "custom",
      message: "End date must be on or after the start date.",
      path: ["endDate"],
    });
  }
});

export const availabilityBlockIdSchema = z.string().uuid();

export type AvailabilityBlockInput = z.infer<typeof availabilityBlockSchema>;