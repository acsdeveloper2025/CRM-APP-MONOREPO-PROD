import React, { useMemo, useState } from 'react';
import {
  Case, NspPropertyIndividualReportData, AddressLocatable, AddressRating, BuildingStatusApf, FlatStatusApf,
  TPCMetPerson, TPCConfirmation, LocalityTypeResiCumOffice, SightStatus, PoliticalConnection, DominatedArea,
  FeedbackFromNeighbour, FinalStatus, CaseStatus, CapturedImage
} from '../../../types';
import { useCases } from '../../../context/CaseContext';
import { FormField, SelectField, TextAreaField, NumberDropdownField } from '../../FormControls';
import ConfirmationModal from '../../ConfirmationModal';
import ImageCapture from '../../ImageCapture';
import SelfieCapture from '../../SelfieCapture';
import PermissionStatus from '../../PermissionStatus';
import AutoSaveFormWrapper from '../../AutoSaveFormWrapper';
import { FORM_TYPES } from '../../../constants/formTypes';
import VerificationFormService from '../../../services/verificationFormService';
import {
  createImageChangeHandler,
  createSelfieImageChangeHandler,
  createAutoSaveImagesChangeHandler,
  combineImagesForAutoSave,
  createFormDataChangeHandler,
  createDataRestoredHandler
} from '../../../utils/imageAutoSaveHelpers';

interface NspPropertyIndividualFormProps {
  caseData: Case;
}

const getEnumOptions = (enumObject: object) => Object.values(enumObject).map(value => (
  <option key={value} value={value}>{value}</option>
));

const NspPropertyIndividualForm: React.FC<NspPropertyIndividualFormProps> = ({ caseData }) => {
  const { updateNspPropertyIndividualReport, updateCaseStatus, toggleSaveCase } = useCases();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const report = caseData.nspPropertyIndividualReport;
  const isReadOnly = caseData.status === CaseStatus.Completed || caseData.isSaved;
  const MIN_IMAGES = 5;

  // Auto-save handlers using helper functions for complete auto-save functionality
  const handleFormDataChange = createFormDataChangeHandler(
    updateNspPropertyIndividualReport,
    caseData.id,
    isReadOnly
  );

  const handleAutoSaveImagesChange = createAutoSaveImagesChangeHandler(
    updateNspPropertyIndividualReport,
    caseData.id,
    report,
    isReadOnly
  );

  const handleDataRestored = createDataRestoredHandler(
    updateNspPropertyIndividualReport,
    caseData.id,
    isReadOnly
  );

  if (!report) {
    return <p className="text-medium-text">No NSP Property Individual report data available.</p>;
  }

  const isFormValid = useMemo(() => {
    if (!report) return false;

    if (report.images.length < MIN_IMAGES) return false;

    // Require at least one selfie image
    if (!report.selfieImages || report.selfieImages.length === 0) return false;

    const checkFields = (fields: (keyof NspPropertyIndividualReportData)[]) => fields.every(field => {
        const value = report[field];
        return value !== null && value !== undefined && value !== '';
    });

    const baseFields: (keyof NspPropertyIndividualReportData)[] = [
        'addressLocatable', 'addressRating', 'buildingStatus', 'flatStatus', 'tpcMetPerson1', 'nameOfTpc1', 'tpcConfirmation1',
        'tpcMetPerson2', 'nameOfTpc2', 'tpcConfirmation2', 'locality', 'addressStructure', 'addressStructureColor', 'doorColor',
        'doorNamePlateStatus', 'societyNamePlateStatus', 'landmark1', 'landmark2', 'politicalConnection', 'dominatedArea',
        'feedbackFromNeighbour', 'otherObservation', 'finalStatus', 'propertyOwnerName'
    ];
    if (!checkFields(baseFields)) return false;

    if (report.flatStatus === FlatStatusApf.Opened) {
        const openedFields: (keyof NspPropertyIndividualReportData)[] = ['metPerson', 'relationship'];
        if (!checkFields(openedFields)) return false;
    }

    if (report.doorNamePlateStatus === SightStatus.Sighted) {
        if (!report.nameOnDoorPlate || report.nameOnDoorPlate.trim() === '') return false;
    }
    if (report.societyNamePlateStatus === SightStatus.Sighted) {
        if (!report.nameOnSocietyBoard || report.nameOnSocietyBoard.trim() === '') return false;
    }

    if (report.finalStatus === FinalStatus.Hold) {
        if (!report.holdReason || report.holdReason.trim() === '') return false;
    }

    return true;
  }, [report]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let processedValue: string | number | null = value;

    if (type === 'number') {
      processedValue = value === '' ? null : Number(value);
    }
    
    if (e.target.tagName === 'SELECT' && value === '') {
        processedValue = null;
    }

    const updates: Partial<NspPropertyIndividualReportData> = { [name]: processedValue };
    updateNspPropertyIndividualReport(caseData.id, updates);
  };
  
  const handleImagesChange = createImageChangeHandler(
    updateNspPropertyIndividualReport,
    caseData.id,
    report,
    handleAutoSaveImagesChange
  );

  const handleSelfieImagesChange = createSelfieImageChangeHandler(
    updateNspPropertyIndividualReport,
    caseData.id,
    report,
    handleAutoSaveImagesChange
  );
  
  const options = useMemo(() => ({
    addressLocatable: getEnumOptions(AddressLocatable),
    addressRating: getEnumOptions(AddressRating),
    buildingStatus: getEnumOptions(BuildingStatusApf),
    flatStatus: getEnumOptions(FlatStatusApf),
    tpcMetPerson: getEnumOptions(TPCMetPerson),
    tpcConfirmation: getEnumOptions(TPCConfirmation),
    localityType: getEnumOptions(LocalityTypeResiCumOffice),
    sightStatus: getEnumOptions(SightStatus),
    politicalConnection: getEnumOptions(PoliticalConnection),
    dominatedArea: getEnumOptions(DominatedArea),
    feedbackFromNeighbour: getEnumOptions(FeedbackFromNeighbour),
    finalStatus: getEnumOptions(FinalStatus),
  }), []);

  return (
    <AutoSaveFormWrapper
      caseId={caseData.id}
      formType={FORM_TYPES.PROPERTY_INDIVIDUAL_NSP}
      formData={report}
      images={combineImagesForAutoSave(report)}
      onFormDataChange={handleFormDataChange}
      onImagesChange={handleAutoSaveImagesChange}
      onDataRestored={handleDataRestored}
      autoSaveOptions={{
        enableAutoSave: !isReadOnly,
        showIndicator: !isReadOnly,
        debounceMs: 500, // Faster auto-save for images (500ms instead of 2000ms)
      }}
    >
      <div className="space-y-4 pt-4 border-t border-dark-border">
      <div className="p-4 bg-gray-900/50 rounded-lg space-y-4 border border-dark-border mb-4">
        <h5 className="font-semibold text-brand-primary">Case Details</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Customer Name" id="case-customerName" name="case-customerName" value={caseData.customer.name} onChange={() => {}} disabled />
            <FormField label="Bank Name" id="case-bankName" name="case-bankName" value={caseData.client?.name || caseData.clientName || ''} onChange={() => {}} disabled />
            <FormField label="Product" id="case-product" name="case-product" value={caseData.product?.name || caseData.productName || ''} onChange={() => {}} disabled />
            <FormField label="Trigger" id="case-trigger" name="case-trigger" value={caseData.notes || caseData.trigger || ''} onChange={() => {}} disabled />
            <div className="md:col-span-2">
              <FormField label="Visit Address" id="case-visitAddress" name="case-visitAddress" value={caseData.addressStreet || caseData.visitAddress || caseData.address || ''} onChange={() => {}} disabled />
            </div>
            <FormField label="System Contact Number" id="case-systemContactNumber" name="case-systemContactNumber" value={caseData.systemContactNumber || ''} onChange={() => {}} disabled />
            <FormField label="Customer Calling Code" id="case-customerCallingCode" name="case-customerCallingCode" value={caseData.customerCallingCode || ''} onChange={() => {}} disabled />
            <FormField label="Applicant Status" id="case-applicantStatus" name="case-applicantStatus" value={caseData.applicantStatus || ''} onChange={() => {}} disabled />
        </div>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField label="Address Locatable" id="addressLocatable" name="addressLocatable" value={report.addressLocatable || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.addressLocatable}</SelectField>
            <SelectField label="Address Rating" id="addressRating" name="addressRating" value={report.addressRating || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.addressRating}</SelectField>
            <SelectField label="Building Status" id="buildingStatus" name="buildingStatus" value={report.buildingStatus || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.buildingStatus}</SelectField>
            <SelectField label="Flat Status" id="flatStatus" name="flatStatus" value={report.flatStatus || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.flatStatus}</SelectField>
        </div>

        {/* Property Owner Name - Always visible regardless of flat status */}
        <div className="p-4 bg-gray-900/50 rounded-lg space-y-4 border border-dark-border">
            <h4 className="font-semibold text-brand-primary">Property Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Property Owner Name" id="propertyOwnerName" name="propertyOwnerName" value={report.propertyOwnerName} onChange={handleChange} disabled={isReadOnly} />
            </div>
        </div>

        {/* Met Person Details Section - Conditional for flat open */}
        {report.flatStatus === FlatStatusApf.Opened && (
            <div className="p-4 bg-yellow-900/20 rounded-lg space-y-4 border border-yellow-600/30">
                <h4 className="font-semibold text-yellow-400">Additional Details (Flat Open)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Met Person" id="metPerson" name="metPerson" value={report.metPerson} onChange={handleChange} disabled={isReadOnly} />
                    <FormField label="Relationship" id="relationship" name="relationship" value={report.relationship} onChange={handleChange} disabled={isReadOnly} />
                </div>
            </div>
        )}

        <div className="p-4 bg-gray-900/50 rounded-lg space-y-4 border border-dark-border">
            <h5 className="font-semibold text-brand-primary">Third Party Confirmation 1</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SelectField label="TPC Met Person" id="tpcMetPerson1" name="tpcMetPerson1" value={report.tpcMetPerson1 || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.tpcMetPerson}</SelectField>
                <FormField label="Name of TPC" id="nameOfTpc1" name="nameOfTpc1" value={report.nameOfTpc1} onChange={handleChange} disabled={isReadOnly} />
                <SelectField label="Confirmation" id="tpcConfirmation1" name="tpcConfirmation1" value={report.tpcConfirmation1 || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.tpcConfirmation}</SelectField>
            </div>
        </div>
        
        <div className="p-4 bg-gray-900/50 rounded-lg space-y-4 border border-dark-border">
            <h5 className="font-semibold text-brand-primary">Third Party Confirmation 2</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SelectField label="TPC Met Person" id="tpcMetPerson2" name="tpcMetPerson2" value={report.tpcMetPerson2 || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.tpcMetPerson}</SelectField>
                <FormField label="Name of TPC" id="nameOfTpc2" name="nameOfTpc2" value={report.nameOfTpc2} onChange={handleChange} disabled={isReadOnly} />
                <SelectField label="Confirmation" id="tpcConfirmation2" name="tpcConfirmation2" value={report.tpcConfirmation2 || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.tpcConfirmation}</SelectField>
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField label="Locality" id="locality" name="locality" value={report.locality || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.localityType}</SelectField>
            <NumberDropdownField label="Address Structure" id="addressStructure" name="addressStructure" value={report.addressStructure || ''} onChange={handleChange} min={1} max={300} disabled={isReadOnly} />
            <FormField label="Address Structure Color" id="addressStructureColor" name="addressStructureColor" value={report.addressStructureColor} onChange={handleChange} disabled={isReadOnly} />
            <FormField label="Door Color" id="doorColor" name="doorColor" value={report.doorColor} onChange={handleChange} disabled={isReadOnly} />
        </div>
            
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <SelectField label="Door Name Plate" id="doorNamePlateStatus" name="doorNamePlateStatus" value={report.doorNamePlateStatus || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.sightStatus}</SelectField>
                {report.doorNamePlateStatus === SightStatus.Sighted && <div className="mt-2 p-2 rounded-md bg-gray-800 border border-dark-border"><FormField label="Name on Door Plate" id="nameOnDoorPlate" name="nameOnDoorPlate" value={report.nameOnDoorPlate} onChange={handleChange} disabled={isReadOnly} /></div>}
            </div>
            <div>
                <SelectField label="Society Name Plate" id="societyNamePlateStatus" name="societyNamePlateStatus" value={report.societyNamePlateStatus || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.sightStatus}</SelectField>
                {report.societyNamePlateStatus === SightStatus.Sighted && <div className="mt-2 p-2 rounded-md bg-gray-800 border border-dark-border"><FormField label="Name on Society Board" id="nameOnSocietyBoard" name="nameOnSocietyBoard" value={report.nameOnSocietyBoard} onChange={handleChange} disabled={isReadOnly} /></div>}
            </div>
        </div>

        <FormField label="Landmark 1" id="landmark1" name="landmark1" value={report.landmark1} onChange={handleChange} disabled={isReadOnly} />
        <FormField label="Landmark 2" id="landmark2" name="landmark2" value={report.landmark2} onChange={handleChange} disabled={isReadOnly} />
      
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SelectField label="Political Connection" id="politicalConnection" name="politicalConnection" value={report.politicalConnection || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.politicalConnection}</SelectField>
            <SelectField label="Dominated Area" id="dominatedArea" name="dominatedArea" value={report.dominatedArea || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.dominatedArea}</SelectField>
            <SelectField label="Feedback from Neighbour" id="feedbackFromNeighbour" name="feedbackFromNeighbour" value={report.feedbackFromNeighbour || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.feedbackFromNeighbour}</SelectField>
        </div>
        
        <TextAreaField label="Other Observation" id="otherObservation" name="otherObservation" value={report.otherObservation} onChange={handleChange} disabled={isReadOnly} />
        
        <SelectField label="Final Status" id="finalStatus" name="finalStatus" value={report.finalStatus || ''} onChange={handleChange} disabled={isReadOnly}><option value="">Select...</option>{options.finalStatus}</SelectField>
        {report.finalStatus === FinalStatus.Hold && <FormField label="Reason for Hold" id="holdReason" name="holdReason" value={report.holdReason} onChange={handleChange} disabled={isReadOnly} />}

        {/* Permission Status Section */}
        <PermissionStatus showOnlyDenied={true} />

        {/* Image Capture Section */}
        <ImageCapture
            images={report.images}
            onImagesChange={handleImagesChange}
            isReadOnly={isReadOnly}
            minImages={MIN_IMAGES}
            compact={true}
        />

        {/* Selfie Capture Section */}
        <SelfieCapture
          images={report.selfieImages || []}
          onImagesChange={handleSelfieImagesChange}
          isReadOnly={isReadOnly}
          required={true}
          title="🤳 Verification Selfie (Required)"
          compact={true}
        />

      {!isReadOnly && caseData.status === CaseStatus.InProgress && (
          <>
            <div className="mt-6">
                <button 
                    onClick={() => setIsConfirmModalOpen(true)}
                    disabled={!isFormValid || isSubmitting}
                    className="w-full px-6 py-3 text-sm font-semibold rounded-md bg-brand-primary hover:bg-brand-secondary text-white transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                >{isSubmitting ? 'Submitting...' : 'Submit'}</button>
                {!isFormValid && <p className="text-xs text-red-400 text-center mt-2">Please fill all required fields and capture at least {MIN_IMAGES} photos to submit.</p>}
                {submissionError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                        <p className="text-red-600 text-sm">{submissionError}</p>
                    </div>
                )}
            </div>
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => {
                    setIsConfirmModalOpen(false);
                    setSubmissionError(null);
                }}
                onSave={() => {
                    toggleSaveCase(caseData.id, true);
                    setIsConfirmModalOpen(false);
                }}
                onConfirm={async () => {
                    setIsSubmitting(true);
                    setSubmissionError(null);
                    
                    try {
                        // Prepare form data for submission
                        const formData = {
                            outcome: report.finalStatus === FinalStatus.Positive ? 'NSP & Door Lock' :
                                    report.finalStatus === FinalStatus.Negative ? 'NSP & Door Lock' :
                                    report.finalStatus === FinalStatus.Fraud ? 'NSP & Door Lock' :
                                    report.finalStatus === FinalStatus.Refer ? 'ERT' :
                                    report.finalStatus === FinalStatus.Hold ? 'ERT' : 'NSP & Door Lock',
                            remarks: report.otherObservation || '',
                            ...report // Include all report data
                        };

                        // Combine all images (regular + selfie)
                        const allImages = [
                            ...(report.images || []),
                            ...(report.selfieImages || [])
                        ];

                        // Get current location if available
                        const geoLocation = report.images?.[0]?.geoLocation ? {
                            latitude: report.images[0].geoLocation.latitude,
                            longitude: report.images[0].geoLocation.longitude,
                            accuracy: report.images[0].geoLocation.accuracy
                        } : undefined;

                        // Submit verification form to backend
                        const result = await VerificationFormService.submitPropertyIndividualVerification(
                            caseData.id,
                            formData,
                            allImages,
                            geoLocation
                        );

                        if (result.success) {
                            // Update local case status
                            updateCaseStatus(caseData.id, CaseStatus.Completed);
                            
                            // Mark auto-save as completed
                            if ((window as any).markAutoSaveFormCompleted) {
                                (window as any).markAutoSaveFormCompleted();
                            }
                            
                            setIsConfirmModalOpen(false);
                            console.log('✅ Property individual verification submitted successfully');
                        } else {
                            setSubmissionError(result.error || 'Failed to submit verification form');
                        }
                    } catch (error) {
                        console.error('❌ Verification submission error:', error);
                        setSubmissionError(error instanceof Error ? error.message : 'Unknown error occurred');
                    } finally {
                        setIsSubmitting(false);
                    }
                }}
                title="Submit or Save Case"
                confirmText={isSubmitting ? "Submitting..." : "Submit Case"}
                saveText="Save for Offline"
            >
                <div className="text-medium-text">
                    <p>You can submit the case to mark it as complete, or save it for offline access if you have a poor internet connection.</p>
                    {submissionError && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-red-600 text-sm font-medium">Submission Error:</p>
                            <p className="text-red-600 text-sm">{submissionError}</p>
                        </div>
                    )}
                </div>
            </ConfirmationModal>
          </>
      )}
      </div>
    </AutoSaveFormWrapper>
  );
};

export default NspPropertyIndividualForm;