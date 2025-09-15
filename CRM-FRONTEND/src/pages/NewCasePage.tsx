import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CaseCreationStepper } from '@/components/cases/CaseCreationStepper';
import { useCase } from '@/hooks/useCases';
import { usePincodes } from '@/hooks/useLocations';
import { useAreasByPincode } from '@/hooks/useAreas';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { CustomerInfoData } from '@/components/cases/CustomerInfoStep';
import type { FullCaseFormData } from '@/components/cases/FullCaseFormStep';

export const NewCasePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editCaseId = searchParams.get('edit');
  const isEditMode = !!editCaseId;



  const [initialData, setInitialData] = useState<{
    customerInfo?: CustomerInfoData;
    caseFormData?: FullCaseFormData;
  } | undefined>();

  // Only fetch case data if we're in edit mode
  const shouldFetchCase = isEditMode && editCaseId;
  const { data: caseData, isLoading: loadingCase } = useCase(shouldFetchCase ? editCaseId : '');

  // Fetch pincodes for mapping pincode code to ID in edit mode
  const { data: pincodesResponse } = usePincodes();

  // Get pincode ID for fetching areas
  const [pincodeIdForAreas, setPincodeIdForAreas] = useState<number | undefined>();
  const { data: areasResponse } = useAreasByPincode(pincodeIdForAreas);

  // First useEffect: Set pincode ID for fetching areas (if pincode exists)
  useEffect(() => {
    if (isEditMode && caseData?.data && pincodesResponse?.data) {
      const caseItem = caseData.data;
      const pincodes = pincodesResponse.data;

      // Find pincode ID based on pincode code
      const foundPincode = pincodes.find(p => p.code === caseItem.pincode);
      if (foundPincode) {
        setPincodeIdForAreas(foundPincode.id);
      } else {
        // If pincode doesn't exist, still proceed with mapping (without areas)
        setPincodeIdForAreas(undefined);
      }
    }
  }, [isEditMode, caseData, pincodesResponse]);

  // Second useEffect: Map all case data when areas are loaded
  useEffect(() => {
    try {
      if (isEditMode && caseData?.data && pincodesResponse?.data) {
        const caseItem = caseData.data;
        const pincodes = pincodesResponse.data;
        const areas = areasResponse?.data || [];

        // Find pincode ID based on pincode code
        const foundPincode = pincodes.find(p => p.code === caseItem.pincode);
        const pincodeId = foundPincode?.id?.toString() || '';

        // Find the correct area based on case data
        let areaId = '';
        if (caseItem.areaId) {
          // If case has areaId, use it
          areaId = String(caseItem.areaId);
        } else if (areas.length > 0) {
          // Otherwise use first available area
          areaId = areas[0].id.toString();
        }

        // Map case data to CustomerInfoData format
        const customerInfo: CustomerInfoData = {
          customerName: String(caseItem.customerName || caseItem.applicantName || ''),
          mobileNumber: String(caseItem.customerPhone || caseItem.applicantPhone || ''),
          panNumber: String(caseItem.panNumber || ''),
          customerCallingCode: String(caseItem.customerCallingCode || '')
        };

        // Map case data to FullCaseFormData format
        const caseFormData: FullCaseFormData = {
          clientId: String(caseItem.clientId || ''),
          productId: String(caseItem.productId || ''),
          verificationType: String(caseItem.verificationTypeName || ''), // Use the joined name
          verificationTypeId: String(caseItem.verificationTypeId || ''),
          applicantType: String(caseItem.applicantType || ''),
          createdByBackendUser: '', // Will be set to current user
          backendContactNumber: String(caseItem.backendContactNumber || ''),
          assignedToId: String(caseItem.assignedTo || ''),
          priority: caseItem.priority || 'MEDIUM', // Keep as string
          trigger: String(caseItem.trigger || caseItem.notes || ''), // Use 'trigger' not 'notes'
          address: String(caseItem.address || ''),
          pincodeId: pincodeId, // Map pincode code to pincode ID
          areaId: areaId, // Use the found area ID
        };

        const mappedData = {
          customerInfo,
          caseFormData
        };

        setInitialData(mappedData);
      }
    } catch (error) {
      console.error('❌ Error in NewCasePage useEffect:', error);
      // Don't redirect on error, just log it
    }
  }, [isEditMode, caseData, pincodesResponse, areasResponse]);

  const handleSuccess = (caseId: string) => {
    navigate(`/cases/${caseId}`);
  };

  const handleCancel = () => {
    navigate('/cases');
  };



  if (isEditMode && loadingCase) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Edit Case</h1>
          <p className="text-muted-foreground">Loading case data... (ID: {editCaseId})</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  // Debug: Show if we're in edit mode but have no data
  if (isEditMode && !loadingCase && !caseData?.data) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-red-600">Edit Mode - No Data</h1>
          <div className="text-muted-foreground space-y-2">
            <p>Edit Case ID: {editCaseId}</p>
            <p>Loading: {loadingCase ? 'Yes' : 'No'}</p>
            <p>Has Case Data: {caseData?.data ? 'Yes' : 'No'}</p>
            <div>
              <p>Case Data:</p>
              <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-40 text-left">
                {JSON.stringify(caseData, null, 2) || 'null'}
              </pre>
            </div>
          </div>
          <Button onClick={() => navigate('/cases')} className="mt-4">
            Back to Cases
          </Button>
        </div>
      </div>
    );
  }

  // Don't render the form in edit mode until we have initial data
  if (isEditMode && !initialData) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Edit Case</h1>
          <p className="text-muted-foreground">Preparing form data... (ID: {editCaseId})</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }



  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {isEditMode ? 'Edit Case' : 'Create New Case'}
        </h1>
        <p className="text-muted-foreground">
          {isEditMode
            ? 'Update the case details using the form below.'
            : 'Follow the steps below to create a new verification case with duplicate detection.'
          }
        </p>
      </div>

      <CaseCreationStepper
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        editMode={isEditMode}
        editCaseId={editCaseId || undefined}
        initialData={initialData}
      />
    </div>
  );
};
