import { Request, Response } from 'express';
import SearchService, { SearchFilters, SearchOptions } from '../services/searchService';
import BusinessRulesService from '../services/businessRulesService';
import AddressStandardizationService from '../services/addressStandardizationService';
import { createAuditLog } from '../utils/auditLogger';
import { pool } from '../config/database';

// Create service instances
const searchService = new SearchService(pool);
const businessRulesService = new BusinessRulesService(pool);
const addressStandardizationService = new AddressStandardizationService();

export class SearchController {
  /**
   * Advanced search for form submissions
   */
  static async searchFormSubmissions(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      // Extract search filters from query parameters
      const filters: SearchFilters = {
        searchTerm: req.query.searchTerm as string,
        customerName: req.query.customerName as string,
        customerPhone: req.query.customerPhone as string,
        customerEmail: req.query.customerEmail as string,
        customerPan: req.query.customerPan as string,
        city: req.query.city as string,
        state: req.query.state as string,
        pincode: req.query.pincode as string,
        addressLocatable: req.query.addressLocatable === 'true' ? true : req.query.addressLocatable === 'false' ? false : undefined,
        verificationType: req.query.verificationType ? (req.query.verificationType as string).split(',') : undefined,
        verifierName: req.query.verifierName as string,
        finalStatus: req.query.finalStatus ? (req.query.finalStatus as string).split(',') : undefined,
        recommendationStatus: req.query.recommendationStatus ? (req.query.recommendationStatus as string).split(',') : undefined,
        riskCategory: req.query.riskCategory ? (req.query.riskCategory as string).split(',') : undefined,
        propertyType: req.query.propertyType ? (req.query.propertyType as string).split(',') : undefined,
        businessName: req.query.businessName as string,
        businessType: req.query.businessType ? (req.query.businessType as string).split(',') : undefined,
        gstNumber: req.query.gstNumber as string
      };

      // Handle date ranges
      if (req.query.verificationDateFrom || req.query.verificationDateTo) {
        filters.verificationDate = {
          from: req.query.verificationDateFrom as string,
          to: req.query.verificationDateTo as string
        };
      }

      if (req.query.createdDateFrom || req.query.createdDateTo) {
        filters.createdDate = {
          from: req.query.createdDateFrom as string,
          to: req.query.createdDateTo as string
        };
      }

      // Handle numeric ranges
      if (req.query.propertyValueMin || req.query.propertyValueMax) {
        filters.propertyValueRange = {
          min: req.query.propertyValueMin ? parseFloat(req.query.propertyValueMin as string) : undefined,
          max: req.query.propertyValueMax ? parseFloat(req.query.propertyValueMax as string) : undefined
        };
      }

      if (req.query.businessTurnoverMin || req.query.businessTurnoverMax) {
        filters.businessTurnoverRange = {
          min: req.query.businessTurnoverMin ? parseFloat(req.query.businessTurnoverMin as string) : undefined,
          max: req.query.businessTurnoverMax ? parseFloat(req.query.businessTurnoverMax as string) : undefined
        };
      }

      // Extract search options
      const options: SearchOptions = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sortBy: req.query.sortBy as string || 'created_at',
        sortOrder: (req.query.sortOrder as 'ASC' | 'DESC') || 'DESC',
        includeRawData: req.query.includeRawData === 'true'
      };

      // Perform search
      const searchResults = await searchService.searchFormSubmissions(filters, options);

      // Log search activity
      await createAuditLog({
        action: 'FORM_SUBMISSIONS_SEARCH',
        entityType: 'SEARCH',
        entityId: `search_${Date.now()}`,
        userId,
        details: {
          filters,
          options,
          resultCount: searchResults.totalCount,
          searchTerm: filters.searchTerm
        }
      });

      res.json({
        success: true,
        data: searchResults,
        message: `Found ${searchResults.totalCount} form submissions`
      });

    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        success: false,
        message: 'Search failed',
        error: {
          code: 'SEARCH_ERROR',
          details: error instanceof Error ? error.message : 'Unknown search error'
        },
      });
    }
  }

  /**
   * Get search suggestions for autocomplete
   */
  static async getSearchSuggestions(req: Request, res: Response) {
    try {
      const { field, term } = req.query;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      if (!field || !term) {
        return res.status(400).json({
          success: false,
          message: 'Field and term parameters are required',
          error: {
            code: 'MISSING_PARAMETERS'
          },
        });
      }

      const validFields = ['customer_name', 'city', 'state', 'business_name', 'verifier_name'];
      if (!validFields.includes(field as string)) {
        return res.status(400).json({
          success: false,
          message: `Invalid field. Must be one of: ${validFields.join(', ')}`,
          error: {
            code: 'INVALID_FIELD'
          },
        });
      }

      const suggestions = await searchService.getSearchSuggestions(
        field as any,
        term as string,
        limit
      );

      res.json({
        success: true,
        data: suggestions,
        message: `Found ${suggestions.length} suggestions`
      });

    } catch (error) {
      console.error('Suggestions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get suggestions',
        error: {
          code: 'SUGGESTIONS_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
      });
    }
  }

  /**
   * Find similar cases
   */
  static async findSimilarCases(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const similarityType = (req.query.type as 'customer' | 'address' | 'business') || 'customer';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;

      const similarCases = await searchService.findSimilarCases(caseId, similarityType, limit);

      res.json({
        success: true,
        data: similarCases,
        message: `Found ${similarCases.length} similar cases`
      });

    } catch (error) {
      console.error('Similar cases error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to find similar cases',
        error: {
          code: 'SIMILAR_CASES_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
      });
    }
  }

  /**
   * Get business rules
   */
  static async getBusinessRules(req: Request, res: Response) {
    try {
      const rules = await businessRulesService.getAllRules();

      res.json({
        success: true,
        data: rules,
        message: `Retrieved ${rules.length} business rules`
      });

    } catch (error) {
      console.error('Business rules error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get business rules',
        error: {
          code: 'BUSINESS_RULES_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
      });
    }
  }

  /**
   * Update business rule
   */
  static async updateBusinessRule(req: Request, res: Response) {
    try {
      const { ruleId } = req.params;
      const updates = req.body;
      const userId = (req as any).user?.id;

      await businessRulesService.updateRule(ruleId, updates);

      await createAuditLog({
        action: 'BUSINESS_RULE_UPDATED',
        entityType: 'BUSINESS_RULE',
        entityId: ruleId,
        userId,
        details: {
          updates,
          ruleId
        }
      });

      res.json({
        success: true,
        message: 'Business rule updated successfully'
      });

    } catch (error) {
      console.error('Update business rule error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update business rule',
        error: {
          code: 'UPDATE_RULE_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
      });
    }
  }

  /**
   * Search standardized addresses
   */
  static async searchAddresses(req: Request, res: Response) {
    try {
      const filters = {
        city: req.query.city as string,
        state: req.query.state as string,
        pincode: req.query.pincode as string,
        addressType: req.query.addressType as string,
        addressQuality: req.query.addressQuality as string,
        isLocatable: req.query.isLocatable === 'true' ? true : req.query.isLocatable === 'false' ? false : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100
      };

      const addresses = await addressStandardizationService.searchAddresses(filters);

      res.json({
        success: true,
        data: addresses,
        message: `Found ${addresses.length} addresses`
      });

    } catch (error) {
      console.error('Address search error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search addresses',
        error: {
          code: 'ADDRESS_SEARCH_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
      });
    }
  }

  /**
   * Get standardized address by case ID
   */
  static async getStandardizedAddress(req: Request, res: Response) {
    try {
      const { caseId } = req.params;

      const address = await addressStandardizationService.getStandardizedAddress(caseId);

      if (!address) {
        return res.status(404).json({
          success: false,
          message: 'Standardized address not found for this case',
          error: {
            code: 'ADDRESS_NOT_FOUND'
          },
        });
      }

      res.json({
        success: true,
        data: address,
        message: 'Standardized address retrieved successfully'
      });

    } catch (error) {
      console.error('Get standardized address error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get standardized address',
        error: {
          code: 'GET_ADDRESS_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
      });
    }
  }
}

export default SearchController;
