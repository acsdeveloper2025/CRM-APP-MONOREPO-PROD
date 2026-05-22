import { BaseEntity, BaseFilters } from './index';

export interface Country extends Omit<BaseEntity, 'id'> {
  id: number; // Numeric ID for countries
  name: string;
  code: string;
  continent: string;
  isActive?: boolean;
  states?: State[];
}

export interface State extends Omit<BaseEntity, 'id'> {
  id: number; // Numeric ID for states
  name: string;
  code: string;
  countryId: number;
  country: string;
  isActive?: boolean;
  cities?: City[];
  cityCount?: number;
}

export interface City extends Omit<BaseEntity, 'id'> {
  id: number; // Numeric ID for cities
  name: string;
  stateId: number;
  state: string;
  countryId: number;
  country: string;
  isActive?: boolean;
  pincodes?: Pincode[];
  pincodeCount?: number;
}

export interface PincodeArea extends Omit<BaseEntity, 'id'> {
  id: number; // Numeric ID for areas
  name: string;
  displayOrder: number;
  pincodeId?: number;
}

// Standalone area row shape returned by GET /api/areas (master list).
// PincodeArea is the M2M-junction shape; Area is the master shape.
export interface Area {
  id: string;
  name: string;
  usageCount: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocationFilters extends BaseFilters {
  countryId?: number;
  stateId?: number;
  cityId?: number;
  pincodeId?: number;
  continent?: string;
  isActive?: boolean;
}

export interface Pincode {
  id: string;
  code: string;
  area?: string; // Deprecated: kept for backward compatibility
  areas: PincodeArea[];
  cityId: string;
  cityName: string;
  state: string;
  country: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
  city?: City;
}

export interface CreateCountryData {
  name: string;
  code: string;
  continent: string;
}

export interface UpdateCountryData {
  name?: string;
  code?: string;
  continent?: string;
  isActive?: boolean;
}

export interface CreateStateData {
  name: string;
  code: string;
  country: string;
}

export interface UpdateStateData {
  name?: string;
  code?: string;
  country?: string;
  isActive?: boolean;
}

export interface CreateCityData {
  name: string;
  state: string;
  country: string;
}

export interface UpdateCityData {
  name?: string;
  state?: string;
  country?: string;
  isActive?: boolean;
}

export interface CreatePincodeData {
  code: string;
  area?: string; // For backward compatibility
  areas?: string[]; // New multi-area support (area IDs)
  cityId: string;
  cityName?: string;
  state?: string;
  country?: string;
}

// New cascading form data types
export interface CascadingCreatePincodeData {
  countryId: string;
  stateId: string;
  cityId: string;
  pincodeCode: string;
  areas: string[];
}

export interface CascadingEditPincodeData {
  countryId: string;
  stateId: string;
  cityId: string;
  pincodeCode: string;
  areas: string[];
}

export interface UpdatePincodeData {
  code?: string;
  cityId?: string;
  isActive?: boolean;
}

export interface AddPincodeAreasData {
  areaIds: number[];
}

export interface UpdatePincodeAreaData {
  name: string;
  displayOrder?: number;
}
