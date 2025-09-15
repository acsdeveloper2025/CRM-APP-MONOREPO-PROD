import React, { useState } from 'react';
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
import { AlertTriangle, Calendar, User, Phone, Mail, CreditCard, Building2, ExternalLink } from 'lucide-react';
import type { DuplicateCase, DeduplicationResult } from '@/services/deduplication';
import { formatDistanceToNow } from 'date-fns';

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
  const [decision, setDecision] = useState<'CREATE_NEW' | 'USE_EXISTING' | null>(null);

  const duplicates = deduplicationResult?.duplicatesFound || [];
  const hasHighScoreMatches = duplicates.some(dup => dup.matchScore >= 80);

  const handleCreateNew = () => {
    if (!rationale.trim()) {
      alert('Please provide a rationale for creating a new case despite duplicates.');
      return;
    }
    onCreateNew(rationale);
  };

  const handleUseExisting = () => {
    if (!selectedCaseId) {
      alert('Please select an existing case to use.');
      return;
    }
    if (!rationale.trim()) {
      alert('Please provide a rationale for using the existing case.');
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
        return 'bg-orange-100 text-orange-800';
      case 'Email':
        return 'bg-yellow-100 text-yellow-800';
      case 'Name':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-muted text-foreground';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Potential Duplicate Cases Found
          </DialogTitle>
          <DialogDescription>
            We found {duplicates.length} potential duplicate case{duplicates.length !== 1 ? 's' : ''} 
            based on the information provided. Please review and decide how to proceed.
            {hasHighScoreMatches && (
              <span className="block mt-2 text-orange-600 font-medium">
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
                {deduplicationResult?.searchCriteria.applicantName && (
                  <Badge variant="outline">Name: {deduplicationResult.searchCriteria.applicantName}</Badge>
                )}
                {deduplicationResult?.searchCriteria.panNumber && (
                  <Badge variant="outline">PAN: {deduplicationResult.searchCriteria.panNumber}</Badge>
                )}
                {deduplicationResult?.searchCriteria.aadhaarNumber && (
                  <Badge variant="outline">Aadhaar: {deduplicationResult.searchCriteria.aadhaarNumber}</Badge>
                )}
                {deduplicationResult?.searchCriteria.applicantPhone && (
                  <Badge variant="outline">Phone: {deduplicationResult.searchCriteria.applicantPhone}</Badge>
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
                className={`cursor-pointer transition-colors ${
                  selectedCaseId === duplicate.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-muted'
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
                        <span className="text-sm text-muted-foreground">
                          Score: {duplicate.matchScore}%
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{duplicate.applicantName}</span>
                        </div>
                        {duplicate.applicantPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{duplicate.applicantPhone}</span>
                          </div>
                        )}
                        {duplicate.applicantEmail && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{duplicate.applicantEmail}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{formatDistanceToNow(new Date(duplicate.createdAt), { addSuffix: true })}</span>
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
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            variant="outline" 
            onClick={handleUseExisting}
            disabled={!selectedCaseId || !rationale.trim() || isProcessing}
          >
            Use Selected Case
          </Button>
          <Button 
            onClick={handleCreateNew}
            disabled={!rationale.trim() || isProcessing}
          >
            Create New Case Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
