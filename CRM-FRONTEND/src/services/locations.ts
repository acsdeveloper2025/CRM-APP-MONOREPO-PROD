import { apiService } from './api';
import type {
  Country,
  State,
  City,
  Pincode,
  PincodeArea,
  CreateCountryData,
  UpdateCountryData,
  CreateStateData,
  UpdateStateData,
  CreateCityData,
  UpdateCityData,
  CreatePincodeData,
  UpdatePincodeData,
  AddPincodeAreasData,
} from '@/types/location';
import type { ApiResponse, PaginationQuery } from '@/types/api';
import { validateResponse } from './schemas/runtime';
import {
  GenericEntitySchema,
  GenericEntityListSchema,
  GenericObjectSchema,
} from './schemas/generic.schema';

export interface LocationQuery extends PaginationQuery {
  search?: string;
  state?: string;
  country?: string;
  continent?: string;
}

export class LocationsService {
  // Country operations
  async getCountries(query: LocationQuery = {}): Promise<ApiResponse<Country[]>> {
    const response = await apiService.get<Country[]>('/countries', query);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'locations',
        endpoint: 'GET /countries',
      });
    }
    return response;
  }

  async getCountryById(id: string): Promise<ApiResponse<Country>> {
    const response = await apiService.get<Country>(`/countries/${id}`);
    if (response?.success && response.data) {
      validateResponse(GenericEntitySchema, response.data, {
        service: 'locations',
        endpoint: 'GET /countries/:id',
      });
    }
    return response;
  }

  async createCountry(data: CreateCountryData): Promise<ApiResponse<Country>> {
    return apiService.post('/countries', data);
  }

  async updateCountry(id: string, data: UpdateCountryData): Promise<ApiResponse<Country>> {
    return apiService.put(`/countries/${id}`, data);
  }

  async deleteCountry(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/countries/${id}`);
  }

  async getCountriesStats(): Promise<ApiResponse<unknown>> {
    const response = await apiService.get<unknown>('/countries/stats');
    if (response?.success && response.data && typeof response.data === 'object') {
      validateResponse(GenericObjectSchema, response.data, {
        service: 'locations',
        endpoint: 'GET /countries/stats',
      });
    }
    return response;
  }

  async getCountriesByContinent(continent: string): Promise<ApiResponse<Country[]>> {
    return this.getCountries({ continent });
  }

  // State operations
  async getStates(query: LocationQuery = {}): Promise<ApiResponse<State[]>> {
    const response = await apiService.get<State[]>('/states', query);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'locations',
        endpoint: 'GET /states',
      });
    }
    return response;
  }

  async getStateById(id: string): Promise<ApiResponse<State>> {
    const response = await apiService.get<State>(`/states/${id}`);
    if (response?.success && response.data) {
      validateResponse(GenericEntitySchema, response.data, {
        service: 'locations',
        endpoint: 'GET /states/:id',
      });
    }
    return response;
  }

  async createState(data: CreateStateData): Promise<ApiResponse<State>> {
    return apiService.post('/states', data);
  }

  async updateState(id: string, data: UpdateStateData): Promise<ApiResponse<State>> {
    return apiService.put(`/states/${id}`, data);
  }

  async deleteState(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/states/${id}`);
  }

  async getStatesByCountry(country: string): Promise<ApiResponse<State[]>> {
    return this.getStates({ country });
  }

  // City operations
  async getCities(query: LocationQuery = {}): Promise<ApiResponse<City[]>> {
    const response = await apiService.get<City[]>('/cities', query);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'locations',
        endpoint: 'GET /cities',
      });
    }
    return response;
  }

  async getCityById(id: string): Promise<ApiResponse<City>> {
    const response = await apiService.get<City>(`/cities/${id}`);
    if (response?.success && response.data) {
      validateResponse(GenericEntitySchema, response.data, {
        service: 'locations',
        endpoint: 'GET /cities/:id',
      });
    }
    return response;
  }

  async createCity(data: CreateCityData): Promise<ApiResponse<City>> {
    return apiService.post('/cities', data);
  }

  async updateCity(id: string, data: UpdateCityData): Promise<ApiResponse<City>> {
    return apiService.put(`/cities/${id}`, data);
  }

  async deleteCity(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/cities/${id}`);
  }

  async getCitiesByState(state: string): Promise<ApiResponse<City[]>> {
    return this.getCities({ state });
  }

  // Pincode operations
  async getPincodes(query: LocationQuery = {}): Promise<ApiResponse<Pincode[]>> {
    const response = await apiService.get<Pincode[]>('/pincodes', query);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'locations',
        endpoint: 'GET /pincodes',
      });
    }
    return response;
  }

  async getPincodeById(id: string): Promise<ApiResponse<Pincode>> {
    const response = await apiService.get<Pincode>(`/pincodes/${id}`);
    if (response?.success && response.data) {
      validateResponse(GenericEntitySchema, response.data, {
        service: 'locations',
        endpoint: 'GET /pincodes/:id',
      });
    }
    return response;
  }

  async getPincodesByCity(cityId: string): Promise<ApiResponse<Pincode[]>> {
    const response = await apiService.get<Pincode[]>(`/cities/${cityId}/pincodes`);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'locations',
        endpoint: 'GET /cities/:cityId/pincodes',
      });
    }
    return response;
  }

  async createPincode(data: CreatePincodeData): Promise<ApiResponse<Pincode>> {
    return apiService.post('/pincodes', data);
  }

  async updatePincode(id: string, data: UpdatePincodeData): Promise<ApiResponse<Pincode>> {
    return apiService.put(`/pincodes/${id}`, data);
  }

  async deletePincode(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/pincodes/${id}`);
  }

  async searchPincodes(query: string): Promise<ApiResponse<Pincode[]>> {
    const response = await apiService.get<Pincode[]>('/pincodes/search', { q: query });
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'locations',
        endpoint: 'GET /pincodes/search',
      });
    }
    return response;
  }

  // Bulk operations
  async bulkImportCities(file: File): Promise<ApiResponse<unknown>> {
    const formData = new FormData();
    formData.append('file', file);
    return apiService.post('/cities/bulk-import', formData);
  }

  async bulkImportPincodes(file: File): Promise<ApiResponse<unknown>> {
    const formData = new FormData();
    formData.append('file', file);
    return apiService.post('/pincodes/bulk-import', formData);
  }

  // Bulk operations for countries
  async bulkImportCountries(file: File): Promise<ApiResponse<unknown>> {
    const formData = new FormData();
    formData.append('file', file);
    return apiService.post('/countries/bulk-import', formData);
  }

  // Bulk operations for states
  async bulkImportStates(file: File): Promise<ApiResponse<unknown>> {
    const formData = new FormData();
    formData.append('file', file);
    return apiService.post('/states/bulk-import', formData);
  }

  // Utility functions
  async getStateNames(): Promise<ApiResponse<State[]>> {
    return this.getStates();
  }

  // Area operations
  async getAreas(
    query: LocationQuery = {}
  ): Promise<
    ApiResponse<
      { id: string; name: string; usageCount: number; createdAt: string; updatedAt: string }[]
    >
  > {
    const response = await apiService.get<
      { id: string; name: string; usageCount: number; createdAt: string; updatedAt: string }[]
    >('/areas', query);
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'locations',
        endpoint: 'GET /areas',
      });
    }
    return response;
  }

  async getAreaById(id: string): Promise<
    ApiResponse<{
      id: string;
      name: string;
      usageCount: number;
      createdAt: string;
      updatedAt: string;
    }>
  > {
    const response = await apiService.get<{
      id: string;
      name: string;
      usageCount: number;
      createdAt: string;
      updatedAt: string;
    }>(`/areas/${id}`);
    if (response?.success && response.data) {
      validateResponse(GenericEntitySchema, response.data, {
        service: 'locations',
        endpoint: 'GET /areas/:id',
      });
    }
    return response;
  }

  async createArea(data: {
    name: string;
  }): Promise<ApiResponse<{ id: string; name: string; createdAt: string; updatedAt: string }>> {
    return apiService.post('/areas', data);
  }

  async updateArea(
    id: string,
    data: { name: string }
  ): Promise<ApiResponse<{ id: string; name: string; updatedAt: string }>> {
    return apiService.put(`/areas/${id}`, data);
  }

  async deleteArea(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/areas/${id}`);
  }

  // Get areas for dropdown/selection
  async getStandaloneAreas(): Promise<ApiResponse<{ id: string; name: string }[]>> {
    const response = await apiService.get<{ id: string; name: string }[]>('/areas/standalone');
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'locations',
        endpoint: 'GET /areas/standalone',
      });
    }
    return response;
  }

  // Pincode area management
  async addPincodeAreas(
    pincodeId: string,
    data: AddPincodeAreasData
  ): Promise<ApiResponse<PincodeArea[]>> {
    return apiService.post(`/pincodes/${pincodeId}/areas`, data);
  }

  async removePincodeArea(pincodeId: string, areaId: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/pincodes/${pincodeId}/areas/${areaId}`);
  }

  async getAreasByPincode(pincodeId: number): Promise<ApiResponse<{ id: number; name: string }[]>> {
    const response = await apiService.get<{ id: number; name: string }[]>(
      `/pincodes/${pincodeId}/areas`
    );
    if (response?.success && Array.isArray(response.data)) {
      validateResponse(GenericEntityListSchema, response.data, {
        service: 'locations',
        endpoint: 'GET /pincodes/:pincodeId/areas',
      });
    }
    return response;
  }
}

export const locationsService = new LocationsService();
