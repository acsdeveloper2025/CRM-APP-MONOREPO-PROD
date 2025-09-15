import React, { useMemo, useState } from 'react';
import {
  Case, ResiCumOfficeReportData, AddressLocatable, AddressRating, ResiCumOfficeStatus, SightStatus,
  RelationResiCumOffice, StayingStatus, BusinessStatusResiCumOffice, BusinessLocation, DocumentShownStatus,
  DocumentType, TPCMetPerson, TPCConfirmation, LocalityTypeResiCumOffice, PoliticalConnection,
  DominatedArea, FeedbackFromNeighbour, FinalStatus, CaseStatus, CapturedImage
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

interface PositiveResiCumOfficeFormProps {
  caseData: Case;
}

const getEnumOptions = (enumObject: object) => Object.values(enumObject).map(value => (
  <option key={value} value={value}>{value}</option>
));

const PositiveResiCumOfficeForm: React.FC<PositiveResiCumOfficeFormProps> = ({ caseData }) => {
  const { updateResiCumOfficeReport, updateCaseStatus, toggleSaveCase } = useCases();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const report = caseData.resiCumOfficeReport;
  const isReadOnly = caseData.status === CaseStatus.Completed || caseData.isSaved;
  const MIN_IMAGES = 5;

  // Auto-save handlers using helper functions for complete auto-save functionality
  const handleFormDataChange = createFormDataChangeHandler(
    updateResiCumOfficeReport,
    caseData.id,
    isReadOnly
  );

  const handleAutoSaveImagesChange = createAutoSaveImagesChangeHandler(
    updateResiCumOfficeReport,
    caseData.id,
    report,
    isReadOnly
  );

  const handleDataRestored = createDataRestoredHandler(
    updateResiCumOfficeReport,
    caseData.id,
    isReadOnly
  );

  if (!report) {
    return <p className="text-medium-text">No Resi-cum-Office report data available for this case.</p>;
  }

  const isFormValid = useMemo(() => {
    if (!report) return false;

    if (report.images.length < MIN_IMAGES) return false;

    // Require at least one selfie image
    if (!report.selfieImages || report.selfieImages.length === 0) return false;

    const checkFields = (fields: (keyof ResiCumOfficeReportData)[]) => fields.every(field => {
        const value = report[field];
        return value !== null && value !== undefined && value !== '';
    });

    const baseFields: (keyof ResiCumOfficeReportData)[] = [
        'addressLocatable', 'addressRating', 'resiCumOfficeStatus', 'locality', 'addressStructure', 'applicantStayingFloor',
        'addressStructureColor', 'doorColor', 'doorNamePlateStatus', 'societyNamePlateStatus', 'companyNamePlateStatus',
        'landmark1', 'landmark2', 'politicalConnection', 'dominatedArea', 'feedbackFromNeighbour', 'otherObservation', 'finalStatus',
        // Always required fields regardless of office status
        'residenceSetup', 'businessSetup', 'stayingPeriod', 'stayingStatus', 'companyNatureOfBusiness',
        'businessPeriod', 'businessStatus', 'businessLocation'
    ];

    if (!checkFields(baseFields)) return false;

    // Always required TPC validations (regardless of office status)
    if (report.tpcMetPerson1) {
        if (!report.tpcName1 || report.tpcName1.trim() === '' || !report.tpcConfirmation1) return false;
    }
    if (report.tpcMetPerson2) {
        if (!report.tpcName2 || report.tpcName2.trim() === '' || !report.tpcConfirmation2) return false;
    }

    // Always required business location validation
    if (report.businessLocation === BusinessLocation.DifferentAddress) {
        if (!report.businessOperatingAddress || report.businessOperatingAddress.trim() === '') return false;
    }

    // Conditional validation - only when office is open
    if (report.resiCumOfficeStatus === ResiCumOfficeStatus.Open) {
        const openedOnlyFields: (keyof ResiCumOfficeReportData)[] = [
            'metPerson', 'relation', 'approxArea', 'documentShownStatus'
        ];
        if (!checkFields(openedOnlyFields)) return false;

        if (report.documentShownStatus === DocumentShownStatus.Showed) {
            if (!report.documentType) return false;
        }
    }

    if (report.doorNamePlateStatus === SightStatus.Sighted) {
        if (!report.nameOnDoorPlate || report.nameOnDoorPlate.trim() === '') return false;
    }
    if (report.societyNamePlateStatus === SightStatus.Sighted) {
        if (!report.nameOnSocietyBoard || report.nameOnSocietyBoard.trim() === '') return false;
    }
    if (report.companyNamePlateStatus === SightStatus.Sighted) {
        if (!report.nameOnBoard || report.nameOnBoard.trim() === '') return false;
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

    const updates: Partial<ResiCumOfficeReportData> = { [name]: processedValue };
    updateResiCumOfficeReport(caseData.id, updates);
  };

  const handleImagesChange = createImageChangeHandler(
    updateResiCumOfficeReport,
    caseData.id,
    report,
    handleAutoSaveImagesChange
  );

  const handleSelfieImagesChange = createSelfieImageChangeHandler(
    updateResiCumOfficeReport,
    caseData.id,
    report,
    handleAutoSaveImagesChange
  );
  
  const options = useMemo(() => ({
    addressLocatable: getEnumOptions(AddressLocatable),
    addressRating: getEnumOptions(AddressRating),
    resiCumOfficeStatus: getEnumOptions(ResiCumOfficeStatus),
    sightStatus: getEnumOptions(SightStatus),
    relation: getEnumOptions(RelationResiCumOffice),
    stayingStatus: getEnumOptions(StayingStatus),
    businessStatus: getEnumOptions(BusinessStatusResiCumOffice),
    businessLocation: getEnumOptions(BusinessLocation),
    documentShownStatus: getEnumOptions(DocumentShownStatus),
    documentType: getEnumOptions(DocumentType),
    tpcMetPerson: getEnumOptions(TPCMetPerson),
    tpcConfirmation: getEnumOptions(TPCConfirmation),
    localityType: getEnumOptions(LocalityTypeResiCumOffice),
    politicalConnection: getEnumOptions(PoliticalConnection),
    dominatedArea: getEnumOptions(DominatedArea),
    feedbackFromNeighbour: getEnumOptions(FeedbackFromNeighbour),
    finalStatus: getEnumOptions(FinalStatus),
  }), []);

  return (
    <AutoSaveFormWrapper
      caseId={caseData.id}
      formType={FORM_TYPES.RESIDENCE_CUM_OFFICE_POSITIVE}
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
      <h3 className="text-lg font-semibold text-brand-primary">Positive Residence-cum-Office Report</h3>

      {/* Customer Information Section */}
      <div className="p-4 bg-gray-900/50 rounded-lg space-y-4 border border-dark-border">
        <h4 className="font-semibold text-brand-primary">Customer Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-sm">
            <span className="text-medium-text">Customer Name: </span>
            <span className="text-light-text">{caseData.customer.name}</span>
          </div>
          <div className="text-sm">
            <span className="text-medium-text">Bank Name: </span>
            <span className="text-light-text">{caseData.client?.name || caseData.clientName || 'N/A'}</span>
          </div>
          <div className="text-sm">
            <span className="text-medium-text">Product: </span>
            <span className="text-light-text">{caseData.product?.name || caseData.productName || 'N/A'}</span>
          </div>
          <div className="text-sm">
            <span className="text-medium-text">Trigger: </span>
            <span className="text-light-text">{caseData.notes || caseData.trigger || 'N/A'}</span>
          </div>
        </div>
        <div className="text-sm">
          <span className="text-medium-text">Visit Address: </span>
          <span className="text-light-text">{caseData.addressStreet || caseData.visitAddress || caseData.address || 'N/A'}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-sm">
            <span className="text-medium-text">System Contact: </span>
            <span className="text-light-text">{caseData.systemContactNumber || 'N/A'}</span>
          </div>
          <div className="text-sm">
            <span className="text-medium-text">Customer Code: </span>
            <span className="text-light-text">{caseData.customerCallingCode || 'N/A'}</span>
          </div>
          <div className="text-sm">
            <span className="text-medium-text">Applicant Status: </span>
            <span className="text-light-text">{caseData.applicantStatus || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Address Verification Section */}
      <div className="p-4 bg-gray-900/50 rounded-lg space-y-4 border border-dark-border">
        <h4 className="font-semibold text-brand-primary">Address Verification</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectField label="Address Locatable" id="addressLocatable" name="addressLocatable" value={report.addressLocatable || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.addressLocatable}
          </SelectField>
          <SelectField label="Address Rating" id="addressRating" name="addressRating" value={report.addressRating || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.addressRating}
          </SelectField>
          <SelectField label="Resi-cum-Office Status" id="resiCumOfficeStatus" name="resiCumOfficeStatus" value={report.resiCumOfficeStatus || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.resiCumOfficeStatus}
          </SelectField>
        </div>
      </div>

      {/* Always Visible Verification Details Section */}
      <div className="p-4 bg-gray-900/50 rounded-lg space-y-4 border border-dark-border">
        <h4 className="font-semibold text-brand-primary">Verification Details</h4>

        {/* Setup Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Residence Setup" id="residenceSetup" name="residenceSetup" value={report.residenceSetup || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.sightStatus}
          </SelectField>
          <SelectField label="Business Setup" id="businessSetup" name="businessSetup" value={report.businessSetup || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.sightStatus}
          </SelectField>
        </div>

        {/* Always Visible Personal Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Staying Period" id="stayingPeriod" name="stayingPeriod" value={report.stayingPeriod} onChange={handleChange} placeholder="e.g., 5 years" disabled={isReadOnly} />
          <SelectField label="Staying Status" id="stayingStatus" name="stayingStatus" value={report.stayingStatus || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.stayingStatus}
          </SelectField>
        </div>

        {/* Business Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Company Nature of Business" id="companyNatureOfBusiness" name="companyNatureOfBusiness" value={report.companyNatureOfBusiness} onChange={handleChange} disabled={isReadOnly} />
          <FormField label="Business Period" id="businessPeriod" name="businessPeriod" value={report.businessPeriod} onChange={handleChange} placeholder="e.g., 2 years" disabled={isReadOnly} />
          <SelectField label="Business Status" id="businessStatus" name="businessStatus" value={report.businessStatus || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.businessStatus}
          </SelectField>
          <SelectField label="Business Location" id="businessLocation" name="businessLocation" value={report.businessLocation || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.businessLocation}
          </SelectField>
        </div>


        {/* Business Operating Address - Conditional field based on Business Location */}
        {report.businessLocation === BusinessLocation.DifferentAddress && (
          <div className="mt-4">
            <FormField
              label="Business Operating Address"
              id="businessOperatingAddress"
              name="businessOperatingAddress"
              value={report.businessOperatingAddress || ''}
              onChange={handleChange}
              disabled={isReadOnly}
              placeholder="Enter business operating address"
            />
          </div>
        )}

        {/* Third Party Confirmation Section */}
        <div className="space-y-4">
          <h5 className="font-semibold text-brand-primary">Third Party Confirmation</h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectField label="TPC Met Person 1" id="tpcMetPerson1" name="tpcMetPerson1" value={report.tpcMetPerson1 || ''} onChange={handleChange} disabled={isReadOnly}>
              <option value="">Select...</option>
              {options.tpcMetPerson}
            </SelectField>
            <FormField label="Name of TPC 1" id="tpcName1" name="tpcName1" value={report.tpcName1} onChange={handleChange} disabled={isReadOnly} />
            <SelectField label="TPC Confirmation 1" id="tpcConfirmation1" name="tpcConfirmation1" value={report.tpcConfirmation1 || ''} onChange={handleChange} disabled={isReadOnly}>
              <option value="">Select...</option>
              {options.tpcConfirmation}
            </SelectField>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectField label="TPC Met Person 2" id="tpcMetPerson2" name="tpcMetPerson2" value={report.tpcMetPerson2 || ''} onChange={handleChange} disabled={isReadOnly}>
              <option value="">Select...</option>
              {options.tpcMetPerson}
            </SelectField>
            <FormField label="Name of TPC 2" id="tpcName2" name="tpcName2" value={report.tpcName2} onChange={handleChange} disabled={isReadOnly} />
            <SelectField label="TPC Confirmation 2" id="tpcConfirmation2" name="tpcConfirmation2" value={report.tpcConfirmation2 || ''} onChange={handleChange} disabled={isReadOnly}>
              <option value="">Select...</option>
              {options.tpcConfirmation}
            </SelectField>
          </div>
        </div>
      </div>

      {/* Conditional Fields - Only show if office is open */}
      {report.resiCumOfficeStatus === ResiCumOfficeStatus.Open && (
        <div className="p-4 bg-yellow-900/20 rounded-lg space-y-4 border border-yellow-600/30">
          <h4 className="font-semibold text-yellow-400">Additional Details (Office Open)</h4>

          {/* Personal Details - Only when Open */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Met Person" id="metPerson" name="metPerson" value={report.metPerson} onChange={handleChange} disabled={isReadOnly} />
            <SelectField label="Relation" id="relation" name="relation" value={report.relation || ''} onChange={handleChange} disabled={isReadOnly}>
              <option value="">Select...</option>
              {options.relation}
            </SelectField>
            <FormField label="Approx Area (Sq. Feet)" id="approxArea" name="approxArea" value={report.approxArea || ''} onChange={handleChange} type="number" disabled={isReadOnly} />
            <SelectField label="Document Shown Status" id="documentShownStatus" name="documentShownStatus" value={report.documentShownStatus || ''} onChange={handleChange} disabled={isReadOnly}>
              <option value="">Select...</option>
              {options.documentShownStatus}
            </SelectField>
          </div>

          {report.documentShownStatus === DocumentShownStatus.Showed && (
            <SelectField label="Document Type" id="documentType" name="documentType" value={report.documentType || ''} onChange={handleChange} disabled={isReadOnly}>
              <option value="">Select...</option>
              {options.documentType}
            </SelectField>
          )}
        </div>
      )}

      {/* Property Details Section */}
      <div className="p-4 bg-gray-900/50 rounded-lg space-y-4 border border-dark-border">
        <h4 className="font-semibold text-brand-primary">Property Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Locality" id="locality" name="locality" value={report.locality || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.localityType}
          </SelectField>
          <NumberDropdownField label="Address Structure" id="addressStructure" name="addressStructure" value={report.addressStructure || ''} onChange={handleChange} min={1} max={300} disabled={isReadOnly} />
          <NumberDropdownField label="Applicant Staying Floor" id="applicantStayingFloor" name="applicantStayingFloor" value={report.applicantStayingFloor || ''} onChange={handleChange} min={1} max={300} disabled={isReadOnly} />
          <FormField label="Address Structure Color" id="addressStructureColor" name="addressStructureColor" value={report.addressStructureColor} onChange={handleChange} disabled={isReadOnly} />
          <FormField label="Door Color" id="doorColor" name="doorColor" value={report.doorColor} onChange={handleChange} disabled={isReadOnly} />
        </div>

        {/* Name Plate Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Door Name Plate" id="doorNamePlateStatus" name="doorNamePlateStatus" value={report.doorNamePlateStatus || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.sightStatus}
          </SelectField>
          {report.doorNamePlateStatus === SightStatus.Sighted && (
            <FormField label="Name on Door Plate" id="nameOnDoorPlate" name="nameOnDoorPlate" value={report.nameOnDoorPlate} onChange={handleChange} disabled={isReadOnly} className="border-red-500" />
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Society Name Plate" id="societyNamePlateStatus" name="societyNamePlateStatus" value={report.societyNamePlateStatus || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.sightStatus}
          </SelectField>
          {report.societyNamePlateStatus === SightStatus.Sighted && (
            <FormField label="Name on Society Board" id="nameOnSocietyBoard" name="nameOnSocietyBoard" value={report.nameOnSocietyBoard} onChange={handleChange} disabled={isReadOnly} className="border-red-500" />
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SelectField label="Company Name Plate" id="companyNamePlateStatus" name="companyNamePlateStatus" value={report.companyNamePlateStatus || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.sightStatus}
          </SelectField>
          {report.companyNamePlateStatus === SightStatus.Sighted && (
            <FormField label="Name on Board" id="nameOnBoard" name="nameOnBoard" value={report.nameOnBoard} onChange={handleChange} disabled={isReadOnly} className="border-red-500" />
          )}
        </div>

        {/* Landmarks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Landmark 1" id="landmark1" name="landmark1" value={report.landmark1} onChange={handleChange} disabled={isReadOnly} />
          <FormField label="Landmark 2" id="landmark2" name="landmark2" value={report.landmark2} onChange={handleChange} disabled={isReadOnly} />
        </div>
      </div>

      {/* Area Assessment Section */}
      <div className="p-4 bg-gray-900/50 rounded-lg space-y-4 border border-dark-border">
        <h4 className="font-semibold text-brand-primary">Area Assessment</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectField label="Political Connection" id="politicalConnection" name="politicalConnection" value={report.politicalConnection || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.politicalConnection}
          </SelectField>
          <SelectField label="Dominated Area" id="dominatedArea" name="dominatedArea" value={report.dominatedArea || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.dominatedArea}
          </SelectField>
          <SelectField label="Feedback from Neighbour" id="feedbackFromNeighbour" name="feedbackFromNeighbour" value={report.feedbackFromNeighbour || ''} onChange={handleChange} disabled={isReadOnly}>
            <option value="">Select...</option>
            {options.feedbackFromNeighbour}
          </SelectField>
        </div>
        <TextAreaField label="Other Observation" id="otherObservation" name="otherObservation" value={report.otherObservation} onChange={handleChange} disabled={isReadOnly} />
      </div>

      {/* Final Status Section */}
      <div className="p-4 bg-gray-900/50 rounded-lg space-y-4 border border-dark-border">
        <h4 className="font-semibold text-brand-primary">Final Status</h4>
        <SelectField label="Final Status" id="finalStatus" name="finalStatus" value={report.finalStatus || ''} onChange={handleChange} disabled={isReadOnly}>
          <option value="">Select...</option>
          {options.finalStatus}
        </SelectField>
        {report.finalStatus === FinalStatus.Hold && (
          <FormField label="Reason for Hold" id="holdReason" name="holdReason" value={report.holdReason} onChange={handleChange} disabled={isReadOnly} />
        )}
      </div>

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
                            remarks: report.otherObservation || '',
                            ...report, // Include all report data
                            outcome: caseData.verificationOutcome // Use ONLY case verification outcome, no fallback (MUST be after spread)
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
                        const result = await VerificationFormService.submitResidenceCumOfficeVerification(
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
                            console.log('✅ Residence cum-office verification submitted successfully');
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

export default PositiveResiCumOfficeForm;