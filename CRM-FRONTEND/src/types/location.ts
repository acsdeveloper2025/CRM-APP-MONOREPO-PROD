export interface Country {
  id: string;
  name: string;
  code: string;
  continent: string;
  createdAt: string;
  updatedAt: string;
  states?: State[];
}

export interface State {
  id: string;
  name: string;
  code: string;
  country: string;
  createdAt: string;
  updatedAt: string;
  cities?: City[];
  cityCount?: number;
}

export interface City {
  id: string;
  name: string;
  state: string;
  country: string;
  createdAt: string;
  updatedAt: string;
  pincodes?: Pincode[];
  pincodeCount?: number;
}

export interface PincodeArea {
  id: string;
  name: string;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
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
  area?: string;
  cityId?: string;
}

export interface AddPincodeAreasData {
  areaIds: number[];
}

export interface UpdatePincodeAreaData {
  name: string;
  displayOrder?: number;
}
