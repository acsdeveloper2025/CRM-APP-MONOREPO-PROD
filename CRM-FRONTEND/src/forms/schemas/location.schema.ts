import { z } from 'zod';

export const CONTINENTS = [
  'Africa',
  'Antarctica',
  'Asia',
  'Europe',
  'North America',
  'Oceania',
  'South America',
] as const;

export const countryFormSchema = z.object({
  name: z.string().min(1, 'Country name is required').max(100, 'Country name is too long'),
  code: z
    .string()
    .min(2, 'Country code must be at least 2 characters')
    .max(3, 'Country code must be at most 3 characters')
    .regex(/^[A-Z]{2,3}$/, 'Country code must be uppercase letters only (ISO format)'),
  continent: z.string().min(1, 'Continent is required'),
});
export type CountryFormData = z.infer<typeof countryFormSchema>;

export const stateFormSchema = z.object({
  name: z.string().min(1, 'State name is required').max(100, 'State name is too long'),
  code: z
    .string()
    .min(2, 'State code must be at least 2 characters')
    .max(10, 'State code is too long')
    .regex(/^[A-Z0-9]+$/, 'State code must contain only uppercase letters and numbers'),
  country: z.string().min(1, 'Country is required'),
});
export type StateFormData = z.infer<typeof stateFormSchema>;

export const cityFormSchema = z.object({
  name: z.string().min(1, 'City name is required').max(100, 'Name too long'),
  state: z.string().min(1, 'State is required'),
  country: z.string().min(1, 'Country is required'),
});
export type CityFormData = z.infer<typeof cityFormSchema>;

export const pincodeFormSchema = z.object({
  code: z
    .string()
    .min(6, 'Pincode must be 6 digits')
    .max(6, 'Pincode must be 6 digits')
    .regex(/^\d{6}$/, 'Pincode must contain only numbers'),
  areas: z
    .array(z.string())
    .min(1, 'At least one area must be selected')
    .max(15, 'Maximum 15 areas allowed'),
  cityId: z.string().min(1, 'City selection is required'),
});
export type PincodeFormData = z.infer<typeof pincodeFormSchema>;

export const areaFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Area name must be at least 2 characters')
    .max(100, 'Area name must be less than 100 characters'),
});
export type AreaFormData = z.infer<typeof areaFormSchema>;
