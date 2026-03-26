import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, ExternalLink, Eye, Loader2 } from 'lucide-react';
import { deduplicationService } from '@/services/deduplication';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface SearchCriteria {
  mobile: string;
  pan: string;
  name: string;
  address: string;
}

interface SearchResult {
  id: string;
  caseId: number;
  caseNumber: string;
  name: string;
  mobile: string;
  pan: string;
  client: string;
  product: string;
  address: string;
  status: string;
  createdAt: string;
  matchTypes: string[];
  matchScore: number;
}

export const DedupePage: React.FC = () => {
  const navigate = useNavigate();
  const [criteria, setCriteria] = useState<SearchCriteria>({
    mobile: '',
    pan: '',
    name: '',
    address: '',
  });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (page = 1) => {
    // Validate that at least one field is filled
    const hasValidCriteria = Object.values(criteria).some(value => value.trim().length > 0);
    
    if (!hasValidCriteria) {
      toast.error('Please enter at least one search criterion');
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const searchData = {
        mobile: criteria.mobile.trim() || undefined,
        pan: criteria.pan.trim() || undefined,
        name: criteria.name.trim() || undefined,
        address: criteria.address.trim() || undefined,
      };

      const response = await deduplicationService.searchGlobalDuplicates(
        searchData,
        page,
        pagination.limit
      );

      if (response.success && response.data) {
        setResults(response.data.results);
        setPagination(response.data.pagination);
        
        if (response.data.results.length === 0) {
          toast.info('No matching cases found');
        } else {
          toast.success(`Found ${response.data.pagination.total} matching case${response.data.pagination.total === 1 ? '' : 's'}`);
        }
      }
    } catch (error) {
      logger.error('Search error:', error);
      toast.error('Failed to search cases. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setCriteria({
      mobile: '',
      pan: '',
      name: '',
      address: '',
    });
    setResults([]);
    setHasSearched(false);
    setPagination({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  };

  const handleViewCase = (caseId: number) => {
    navigate(`/cases/${caseId}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'default';
      case 'IN_PROGRESS':
        return 'secondary';
      case 'PENDING':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">Dedupe Search</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
            Search for cases across all clients and products
          </p>
        </div>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle>Search Criteria</CardTitle>
          <CardDescription>
            Enter at least one search criterion to find matching cases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile Number</Label>
              <Input
                id="mobile"
                placeholder="Enter mobile number"
                value={criteria.mobile}
                onChange={(e) => setCriteria({ ...criteria, mobile: e.target.value })}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pan">PAN Number</Label>
              <Input
                id="pan"
                placeholder="Enter PAN (e.g., ABCDE1234F)"
                value={criteria.pan}
                onChange={(e) => setCriteria({ ...criteria, pan: e.target.value.toUpperCase() })}
                maxLength={10}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Customer Name</Label>
              <Input
                id="name"
                placeholder="Enter customer name"
                value={criteria.name}
                onChange={(e) => setCriteria({ ...criteria, name: e.target.value })}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Enter address"
                value={criteria.address}
                onChange={(e) => setCriteria({ ...criteria, address: e.target.value })}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button onClick={() => handleSearch(1)} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleClear} disabled={isLoading}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Search Results</CardTitle>
                <CardDescription>
                  {pagination.total > 0
                    ? `Showing ${results.length} of ${pagination.total} matching case${pagination.total === 1 ? '' : 's'}`
                    : 'No cases found'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Case ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>PAN</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Match</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((result) => (
                        <TableRow key={result.id}>
                          <TableCell className="font-medium">
                            {result.caseNumber || result.caseId}
                          </TableCell>
                          <TableCell>{result.name || '-'}</TableCell>
                          <TableCell>{result.mobile || '-'}</TableCell>
                          <TableCell>{result.pan || '-'}</TableCell>
                          <TableCell>{result.client || '-'}</TableCell>
                          <TableCell>{result.product || '-'}</TableCell>
                          <TableCell className="max-w-xs truncate" title={result.address}>
                            {result.address || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(result.status)}>
                              {result.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-1 flex-wrap">
                                {result.matchTypes.map((type) => (
                                  <Badge key={type} variant="secondary" className="text-xs">
                                    {type}
                                  </Badge>
                                ))}
                              </div>
                              <span className="text-xs text-gray-500">
                                Score: {result.matchScore}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {formatDate(result.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewCase(result.caseId)}
                                title="View Case Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(`/cases/${result.caseId}`, '_blank')}
                                title="Open in New Tab"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t">
                    <div className="text-sm text-gray-600">
                      Page {pagination.page} of {pagination.totalPages}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSearch(pagination.page - 1)}
                        disabled={pagination.page === 1 || isLoading}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSearch(pagination.page + 1)}
                        disabled={pagination.page === pagination.totalPages || isLoading}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No cases found</h3>
                <p className="text-sm text-gray-600">
                  Try adjusting your search criteria
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
