export interface Address {
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface StandardizedAddress extends Address {
  formatted: string;
  confidence: number;
  components: {
    houseNumber?: string;
    streetName?: string;
    locality?: string;
    subLocality?: string;
    city: string;
    district?: string;
    state: string;
    pincode: string;
    country: string;
  };
}

export interface AddressValidationResult {
  isValid: boolean;
  standardized?: StandardizedAddress;
  suggestions?: StandardizedAddress[];
  errors?: string[];
}

class AddressStandardizationService {
  private readonly INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
  ];

  async standardizeAddress(address: string | Address): Promise<AddressValidationResult> {
    try {
      const addressObj = typeof address === 'string' 
        ? this.parseAddressString(address)
        : address;

      const validation = this.validateAddressComponents(addressObj);
      
      if (!validation.isValid) {
        return validation;
      }

      const standardized = await this.standardizeComponents(addressObj);
      
      return {
        isValid: true,
        standardized,
        suggestions: []
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      };
    }
  }

  private parseAddressString(address: string): Address {
    // Simple address parsing - can be enhanced with more sophisticated logic
    const parts = address.split(',').map(part => part.trim());
    
    const result: Address = {};
    
    // Try to extract pincode (6 digits)
    const pincodeMatch = address.match(/\b\d{6}\b/);
    if (pincodeMatch) {
      result.pincode = pincodeMatch[0];
    }

    // Try to extract state
    const stateMatch = this.INDIAN_STATES.find(state => 
      address.toLowerCase().includes(state.toLowerCase())
    );
    if (stateMatch) {
      result.state = stateMatch;
    }

    // Remaining parts as street address
    if (parts.length > 0) {
      result.street = parts[0];
    }

    if (parts.length > 1 && !result.state) {
      result.city = parts[parts.length - 1];
    }

    return result;
  }

  private validateAddressComponents(address: Address): AddressValidationResult {
    const errors: string[] = [];

    // Validate pincode
    if (address.pincode) {
      if (!/^\d{6}$/.test(address.pincode)) {
        errors.push('Pincode must be 6 digits');
      }
    }

    // Validate state
    if (address.state) {
      const isValidState = this.INDIAN_STATES.some(state => 
        state.toLowerCase() === address.state?.toLowerCase()
      );
      if (!isValidState) {
        errors.push('Invalid state name');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private async standardizeComponents(address: Address): Promise<StandardizedAddress> {
    // Standardize state name
    const standardizedState = address.state 
      ? this.INDIAN_STATES.find(state => 
          state.toLowerCase() === address.state?.toLowerCase()
        ) || address.state
      : '';

    // Format the address
    const addressParts = [
      address.street,
      address.city,
      standardizedState,
      address.pincode,
      address.country || 'India'
    ].filter(Boolean);

    const formatted = addressParts.join(', ');

    return {
      ...address,
      state: standardizedState,
      country: address.country || 'India',
      formatted,
      confidence: this.calculateConfidence(address),
      components: {
        streetName: address.street,
        city: address.city || '',
        state: standardizedState,
        pincode: address.pincode || '',
        country: address.country || 'India'
      }
    };
  }

  private calculateConfidence(address: Address): number {
    let score = 0;
    let maxScore = 0;

    // Street address
    maxScore += 20;
    if (address.street && address.street.trim().length > 0) {
      score += 20;
    }

    // City
    maxScore += 20;
    if (address.city && address.city.trim().length > 0) {
      score += 20;
    }

    // State
    maxScore += 25;
    if (address.state && this.INDIAN_STATES.includes(address.state)) {
      score += 25;
    }

    // Pincode
    maxScore += 25;
    if (address.pincode && /^\d{6}$/.test(address.pincode)) {
      score += 25;
    }

    // Country
    maxScore += 10;
    if (address.country) {
      score += 10;
    }

    return Math.round((score / maxScore) * 100);
  }

  async validatePincode(pincode: string): Promise<{ isValid: boolean; area?: string; district?: string; state?: string }> {
    // Simple pincode validation - in production, this would use a pincode database
    if (!/^\d{6}$/.test(pincode)) {
      return { isValid: false };
    }

    // Mock validation based on pincode ranges
    const firstDigit = parseInt(pincode[0]);
    const stateMapping: { [key: number]: string } = {
      1: 'Delhi',
      2: 'Haryana',
      3: 'Punjab',
      4: 'Rajasthan',
      5: 'Uttar Pradesh',
      6: 'Bihar',
      7: 'West Bengal',
      8: 'Odisha'
    };

    return {
      isValid: true,
      state: stateMapping[firstDigit] || 'Unknown',
      district: 'Unknown',
      area: 'Unknown'
    };
  }

  async geocodeAddress(address: string | Address): Promise<{ latitude?: number; longitude?: number; accuracy?: string }> {
    // Mock geocoding - in production, this would use a geocoding service
    return {
      latitude: 28.6139, // Delhi coordinates as default
      longitude: 77.2090,
      accuracy: 'approximate'
    };
  }

  formatAddressForDisplay(address: StandardizedAddress): string {
    return address.formatted;
  }

  formatAddressForPostal(address: StandardizedAddress): string {
    const lines = [];

    if (address.components.streetName) {
      lines.push(address.components.streetName);
    }

    if (address.components.locality) {
      lines.push(address.components.locality);
    }

    if (address.components.city) {
      lines.push(address.components.city);
    }

    const lastLine = [
      address.components.state,
      address.components.pincode
    ].filter(Boolean).join(' - ');

    if (lastLine) {
      lines.push(lastLine);
    }

    if (address.components.country) {
      lines.push(address.components.country);
    }

    return lines.join('\n');
  }

  async searchAddresses(filters: any): Promise<StandardizedAddress[]> {
    // Mock implementation - in production, this would search a database
    return [];
  }

  async getStandardizedAddress(caseId: string): Promise<StandardizedAddress | null> {
    // Mock implementation - in production, this would fetch from database
    return null;
  }
}

export default AddressStandardizationService;
