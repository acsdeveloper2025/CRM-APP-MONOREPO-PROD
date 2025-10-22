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
  AddPincodeAreasData
} from '@/types/location';
import type { ApiResponse, PaginationQuery } from '@/types/api';

// Smart API URL selection
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
    const staticIP = import.meta.env.VITE_STATIC_IP || '103.14.234.36';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLocalNetwork = hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.');
  const isStaticIP = hostname === staticIP;
  const isDomain = hostname === 'crm.allcheckservices.com' || hostname === 'www.crm.allcheckservices.com';

  // Priority order for API URL selection:
  // 1. Check if we're on localhost (development)
  if (isLocalhost) {
    return 'http://localhost:3000/api';
  }

  // 2. Check if we're on the local network IP (hairpin NAT workaround)
  if (isLocalNetwork) {
    return `http://${staticIP}:3000/api`;
  }

  // 3. Check if we're on the domain name (production access)
  if (isDomain) {
    return 'https://crm.allcheckservices.com/api';
  }

  // 4. Check if we're on the static IP (external access)
  if (isStaticIP) {
    return `http://${staticIP}:3000/api`;
  }

  // 5. Fallback to environment variable or localhost
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
};

export interface LocationQuery extends PaginationQuery {
  search?: string;
  state?: string;
  country?: string;
  continent?: string;
}

export class LocationsService {
  // Country operations
  async getCountries(query: LocationQuery = {}): Promise<ApiResponse<Country[]>> {
    return apiService.get('/countries', query);
  }

  async getCountryById(id: string): Promise<ApiResponse<Country>> {
    return apiService.get(`/countries/${id}`);
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

  async getCountriesStats(): Promise<ApiResponse<any>> {
    return apiService.get('/countries/stats');
  }

  async getCountriesByContinent(continent: string): Promise<ApiResponse<Country[]>> {
    return this.getCountries({ continent });
  }

  // State operations
  async getStates(query: LocationQuery = {}): Promise<ApiResponse<State[]>> {
    return apiService.get('/states', query);
  }

  async getStateById(id: string): Promise<ApiResponse<State>> {
    return apiService.get(`/states/${id}`);
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
    return apiService.get('/cities', query);
  }

  async getCityById(id: string): Promise<ApiResponse<City>> {
    return apiService.get(`/cities/${id}`);
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
    return apiService.get('/pincodes', query);
  }

  async getPincodeById(id: string): Promise<ApiResponse<Pincode>> {
    return apiService.get(`/pincodes/${id}`);
  }

  async getPincodesByCity(cityId: string): Promise<ApiResponse<Pincode[]>> {
    return apiService.get(`/cities/${cityId}/pincodes`);
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
    return apiService.get('/pincodes/search', { q: query });
  }

  // Bulk operations
  async bulkImportCities(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/cities/bulk-import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
      },
      body: formData,
    });

    return response.json();
  }

  async bulkImportPincodes(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);

    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/pincodes/bulk-import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
      },
      body: formData,
    });

    return response.json();
  }

  // Bulk operations for countries
  async bulkImportCountries(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);

    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/countries/bulk-import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
      },
      body: formData,
    });

    return response.json();
  }

  // Bulk operations for states
  async bulkImportStates(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);

    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/states/bulk-import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`,
      },
      body: formData,
    });

    return response.json();
  }

  // Utility functions
  async getStateNames(): Promise<ApiResponse<State[]>> {
    return this.getStates();
  }

  // Area operations
  async getAreas(query: LocationQuery = {}): Promise<ApiResponse<{ id: string; name: string; usageCount: number; createdAt: string; updatedAt: string }[]>> {
    return apiService.get('/areas', query);
  }

  async getAreaById(id: string): Promise<ApiResponse<{ id: string; name: string; usageCount: number; createdAt: string; updatedAt: string }>> {
    return apiService.get(`/areas/${id}`);
  }

  async createArea(data: { name: string }): Promise<ApiResponse<{ id: string; name: string; createdAt: string; updatedAt: string }>> {
    return apiService.post('/areas', data);
  }

  async updateArea(id: string, data: { name: string }): Promise<ApiResponse<{ id: string; name: string; updatedAt: string }>> {
    return apiService.put(`/areas/${id}`, data);
  }

  async deleteArea(id: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/areas/${id}`);
  }

  // Get areas for dropdown/selection
  async getStandaloneAreas(): Promise<ApiResponse<{ id: string; name: string }[]>> {
    return apiService.get('/areas/standalone');
  }

  // Pincode area management
  async addPincodeAreas(pincodeId: string, data: AddPincodeAreasData): Promise<ApiResponse<PincodeArea[]>> {
    return apiService.post(`/pincodes/${pincodeId}/areas`, data);
  }

  async removePincodeArea(pincodeId: string, areaId: string): Promise<ApiResponse<void>> {
    return apiService.delete(`/pincodes/${pincodeId}/areas/${areaId}`);
  }

  async getAreasByPincode(pincodeId: number): Promise<ApiResponse<{ id: number; name: string }[]>> {
    return apiService.get(`/pincodes/${pincodeId}/areas`);
  }
}

export const locationsService = new LocationsService();
