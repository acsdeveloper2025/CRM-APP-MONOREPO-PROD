import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Calendar, User, Phone, Mail, Building2, ExternalLink, Package, FileCheck, MapPin, CheckCircle } from 'lucide-react';
import type { DeduplicationResult } from '@/services/deduplication';
import { format } from 'date-fns';

interface DeduplicationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  deduplicationResult: DeduplicationResult | null;
  onCreateNew: (rationale: string) => void;
  onUseExisting: (caseId: string, rationale: string) => void;
  isProcessing?: boolean;
}

export const DeduplicationDialog: React.FC<DeduplicationDialogProps> = ({
  isOpen,
  onClose,
  deduplicationResult,
  onCreateNew,
  onUseExisting,
  isProcessing = false
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');

  // CRITICAL FIX: Show ALL duplicates, not just 100% matches
  // Let the user review and decide based on all potential matches
  const duplicates = deduplicationResult?.duplicatesFound || [];
  const hasHighScoreMatches = duplicates.some(dup => dup.matchScore >= 80);

  const handleCreateNew = () => {
    if (!rationale.trim()) {
      toast.error('Please provide a rationale for creating a new case despite duplicates.');
      return;
    }
    onCreateNew(rationale);
  };

  const handleUseExisting = () => {
    if (!selectedCaseId) {
      toast.error('Please select an existing case to use.');
      return;
    }
    if (!rationale.trim()) {
      toast.error('Please provide a rationale for using the existing case.');
      return;
    }
    onUseExisting(selectedCaseId, rationale);
  };

  const getMatchTypeColor = (matchType: string) => {
    switch (matchType) {
      case 'PAN':
      case 'Aadhaar':
        return 'bg-red-100 text-red-800';
      case 'Phone':
      case 'Bank Account':
        return 'bg-yellow-100 text-orange-800';
      case 'Email':
        return 'bg-yellow-100 text-yellow-800';
      case 'Name':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-slate-100 text-slate-900 dark:bg-slate-800/60 dark:text-slate-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'inProgress':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-900 dark:bg-slate-800/60 dark:text-slate-100';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Potential Duplicate Cases Found
          </DialogTitle>
          <DialogDescription>
            We found {duplicates.length} potential duplicate case{duplicates.length !== 1 ? 's' : ''} 
            based on the information provided. Please review and decide how to proceed.
            {hasHighScoreMatches && (
              <span className="block mt-2 text-yellow-600 font-medium">
                ⚠️ High confidence matches detected - please review carefully
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Criteria Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Search Criteria Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {deduplicationResult?.searchCriteria.customerName && (
                  <Badge variant="outline">Name: {deduplicationResult.searchCriteria.customerName}</Badge>
                )}
                {deduplicationResult?.searchCriteria.panNumber && (
                  <Badge variant="outline">PAN: {deduplicationResult.searchCriteria.panNumber}</Badge>
                )}
                {deduplicationResult?.searchCriteria.aadhaarNumber && (
                  <Badge variant="outline">Aadhaar: {deduplicationResult.searchCriteria.aadhaarNumber}</Badge>
                )}
                {deduplicationResult?.searchCriteria.customerPhone && (
                  <Badge variant="outline">Phone: {deduplicationResult.searchCriteria.customerPhone}</Badge>
                )}
                {deduplicationResult?.searchCriteria.applicantEmail && (
                  <Badge variant="outline">Email: {deduplicationResult.searchCriteria.applicantEmail}</Badge>
                )}
                {deduplicationResult?.searchCriteria.bankAccountNumber && (
                  <Badge variant="outline">Bank Account: {deduplicationResult.searchCriteria.bankAccountNumber}</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Duplicate Cases List */}
          <div className="space-y-3">
            <h4 className="font-medium">Potential Duplicate Cases:</h4>
            {duplicates.map((duplicate) => (
              <Card
                key={duplicate.id}
                className={`cursor-pointer transition-colors border-2 ${
                  selectedCaseId === duplicate.id
                    ? 'ring-2 ring-emerald-500 bg-emerald-50 border-emerald-500'
                    : 'hover:bg-[#FAFAFA] hover:border-emerald-300 border-gray-200'
                }`}
                onClick={() => setSelectedCaseId(duplicate.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{duplicate.caseNumber}</span>
                        <Badge className={getStatusColor(duplicate.status)}>
                          {duplicate.status}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          Score: {duplicate.matchScore}%
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-600" />
                          <span>{duplicate.customerName}</span>
                        </div>
                        {duplicate.customerPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-600" />
                            <span>{duplicate.customerPhone}</span>
                          </div>
                        )}
                        {duplicate.customerEmail && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-gray-600" />
                            <span>{duplicate.customerEmail}</span>
                          </div>
                        )}
                        {duplicate.clientName && (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-600" />
                            <span className="font-medium">{duplicate.clientName}</span>
                          </div>
                        )}
                        {duplicate.productName && (
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-600" />
                            <span>{duplicate.productName}</span>
                          </div>
                        )}
                        {duplicate.verificationTypeName && (
                          <div className="flex items-center gap-2">
                            <FileCheck className="h-4 w-4 text-gray-600" />
                            <span>{duplicate.verificationTypeName}</span>
                          </div>
                        )}
                        {duplicate.pincode && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-600" />
                            <span>{duplicate.pincode}</span>
                          </div>
                        )}
                        {duplicate.verificationOutcome && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-gray-600" />
                            <Badge variant="outline" className="text-xs">
                              {duplicate.verificationOutcome}
                            </Badge>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-600" />
                          <span>{format(new Date(duplicate.createdAt), 'MMM d, yyyy \'at\' h:mm a')}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {duplicate.matchType.map((type) => (
                          <Badge key={type} className={getMatchTypeColor(type)} variant="secondary">
                            {type} Match
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/cases/${duplicate.id}`, '_blank');
                      }}
                      title="View case details in new tab"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Decision Section */}
          <div className="space-y-4 pt-4 border-t">
            <Label htmlFor="rationale">Decision Rationale *</Label>
            <Textarea
              id="rationale"
              placeholder="Please explain your decision to create a new case or use an existing one..."
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button 
            variant="outline" 
            onClick={handleUseExisting}
            disabled={!selectedCaseId || !rationale.trim() || isProcessing}
           className="w-full sm:w-auto">
            Use Selected Case
          </Button>
          <Button 
            onClick={handleCreateNew}
            disabled={!rationale.trim() || isProcessing}
           className="w-full sm:w-auto">
            Create New Case Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
