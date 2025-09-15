import { Request, Response } from 'express';
import { MobileFormSubmissionRequest, FormSubmissionData, FormSection, FormField } from '../types/mobile';
import { createAuditLog } from '../utils/auditLogger';
import { detectResidenceFormType, detectOfficeFormType, detectBusinessFormType, detectPropertyIndividualFormType } from '../utils/formTypeDetection';
import { mapFormDataToDatabase, validateRequiredFields, getAvailableDbColumns } from '../utils/residenceFormFieldMapping';
import { validateAndPrepareResidenceForm, generateFieldCoverageReport } from '../utils/residenceFormValidator';
import { validateAndPrepareOfficeForm, generateOfficeFieldCoverageReport } from '../utils/officeFormValidator';
import { validateAndPrepareBusinessForm, generateBusinessFieldCoverageReport } from '../utils/businessFormValidator';
import { validateAndPrepareResidenceCumOfficeForm, generateResidenceCumOfficeFieldCoverageReport } from '../utils/residenceCumOfficeFormValidator';
import { validateAndPrepareBuilderForm, generateBuilderFieldCoverageReport } from '../utils/builderFormValidator';
import { validateAndPrepareNocForm, generateNocFieldCoverageReport } from '../utils/nocFormValidator';
import { validateAndPreparePropertyApfForm, generatePropertyApfFieldCoverageReport } from '../utils/propertyApfFormValidator';
import { validateAndPreparePropertyIndividualForm, generatePropertyIndividualFieldCoverageReport } from '../utils/propertyIndividualFormValidator';
import { validateAndPrepareDsaConnectorForm, generateDsaConnectorFieldCoverageReport } from '../utils/dsaConnectorFormValidator';
import { mapOfficeFormDataToDatabase, validateOfficeRequiredFields, getOfficeAvailableDbColumns } from '../utils/officeFormFieldMapping';
import { mapBusinessFormDataToDatabase, validateBusinessRequiredFields, getBusinessAvailableDbColumns } from '../utils/businessFormFieldMapping';
import {
  createComprehensiveFormSections,
  getFormTypeLabel,
  getVerificationTableName
} from '../utils/comprehensiveFormFieldMapping';
import { mapBuilderFormDataToDatabase, validateBuilderRequiredFields, getBuilderAvailableDbColumns } from '../utils/builderFormFieldMapping';
import { mapResidenceCumOfficeFormDataToDatabase, validateResidenceCumOfficeRequiredFields, getResidenceCumOfficeAvailableDbColumns } from '../utils/residenceCumOfficeFormFieldMapping';
import { mapNocFormDataToDatabase, validateNocRequiredFields, getNocAvailableDbColumns } from '../utils/nocFormFieldMapping';
import { mapPropertyApfFormDataToDatabase, validatePropertyApfRequiredFields, getPropertyApfAvailableDbColumns } from '../utils/propertyApfFormFieldMapping';
import { mapPropertyIndividualFormDataToDatabase, validatePropertyIndividualRequiredFields, getPropertyIndividualAvailableDbColumns } from '../utils/propertyIndividualFormFieldMapping';
import { mapDsaConnectorFormDataToDatabase, validateDsaConnectorRequiredFields, getDsaConnectorAvailableDbColumns } from '../utils/dsaConnectorFormFieldMapping';
import { config } from '../config';
import { query } from '@/config/database';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import { queueCaseCompletionNotification } from '../queues/notificationQueue';
import { logger } from '../utils/logger';
// Enhanced services temporarily disabled for debugging

export class MobileFormController {
  /**
   * Helper function to send case completion notifications to backend users
   */
  private static async sendCaseCompletionNotification(
    caseId: string,
    caseNumber: string,
    customerName: string,
    fieldUserId: string,
    completionStatus: string,
    outcome: string
  ): Promise<void> {
    try {
      // Get field user information
      const fieldUserQuery = `
        SELECT name, "employeeId" FROM users WHERE id = $1
      `;
      const fieldUserResult = await query(fieldUserQuery, [fieldUserId]);
      const fieldUserName = fieldUserResult.rows[0]?.name || 'Unknown User';

      // Get users who should receive case completion notifications
      // BACKEND_USER, REPORT_PERSON, and SUPER_ADMIN roles
      const notificationUsersQuery = `
        SELECT id FROM users
        WHERE role IN ('BACKEND_USER', 'REPORT_PERSON', 'SUPER_ADMIN')
        AND "isActive" = true
      `;
      const notificationUsersResult = await query(notificationUsersQuery);
      const notificationUserIds = notificationUsersResult.rows.map(row => row.id);

      if (notificationUserIds.length > 0) {
        // Queue case completion notification
        await queueCaseCompletionNotification({
          caseId,
          caseNumber,
          customerName,
          fieldUserId,
          fieldUserName,
          completionStatus,
          outcome,
          backendUserIds: notificationUserIds, // Keep the same parameter name for compatibility
        });

        logger.info('Case completion notification queued', {
          caseId,
          caseNumber,
          fieldUserId,
          fieldUserName,
          backendUserCount: notificationUserIds.length,
        });
      }
    } catch (error) {
      logger.error('Failed to send case completion notification:', error);
      // Don't throw error to avoid breaking the main form submission flow
    }
  }

  /**
   * Process and store verification images separately from case attachments
   */
  private static async processVerificationImages(
    images: any[],
    caseId: string,
    verificationType: string,
    submissionId: string,
    userId: string
  ): Promise<any[]> {
    const uploadedImages: any[] = [];

    if (!images || images.length === 0) {
      return uploadedImages;
    }

    // Create upload directory for verification images
    const uploadDir = path.join(
      process.cwd(),
      'uploads',
      'verification',
      verificationType.toLowerCase(),
      caseId
    );

    await fs.mkdir(uploadDir, { recursive: true });

    // Create thumbnails directory
    const thumbnailDir = path.join(uploadDir, 'thumbnails');
    await fs.mkdir(thumbnailDir, { recursive: true });

    for (let i = 0; i < images.length; i++) {
      const image = images[i];

      try {
        // Generate unique filename
        const timestamp = Date.now();
        const randomSuffix = Math.round(Math.random() * 1E9);
        const photoType = image.type || 'verification';
        const extension = '.jpg'; // Convert all to JPEG for consistency
        const filename = `${photoType}_${timestamp}_${randomSuffix}${extension}`;
        const filePath = path.join(uploadDir, filename);
        const thumbnailPath = path.join(thumbnailDir, `thumb_${filename}`);

        // Convert base64 to buffer and save
        const base64Data = image.dataUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Save original image
        await fs.writeFile(filePath, imageBuffer);

        // Generate thumbnail
        await sharp(imageBuffer)
          .resize(200, 200, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);

        // Save to verification_attachments table
        const attachmentResult = await query(
          `INSERT INTO verification_attachments (
            case_id, "caseId", verification_type, filename, "originalName",
            "mimeType", "fileSize", "filePath", "thumbnailPath", "uploadedBy",
            "geoLocation", "photoType", "submissionId"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id, filename, "filePath", "thumbnailPath", "createdAt"`,
          [
            caseId,
            null, // caseId integer - will be set later if needed
            verificationType,
            filename,
            `${photoType}_image_${i + 1}.jpg`,
            'image/jpeg',
            imageBuffer.length,
            `/uploads/verification/${verificationType.toLowerCase()}/${caseId}/${filename}`,
            `/uploads/verification/${verificationType.toLowerCase()}/${caseId}/thumbnails/thumb_${filename}`,
            userId,
            image.geoLocation ? JSON.stringify(image.geoLocation) : null,
            photoType,
            submissionId
          ]
        );

        const attachment = attachmentResult.rows[0];
        uploadedImages.push({
          id: attachment.id,
          filename: attachment.filename,
          url: attachment.filePath,
          thumbnailUrl: attachment.thumbnailPath,
          uploadedAt: attachment.createdAt.toISOString(),
          photoType,
          geoLocation: image.geoLocation
        });

      } catch (error) {
        console.error(`Error processing verification image ${i + 1}:`, error);
        // Continue with other images even if one fails
      }
    }

    return uploadedImages;
  }

  // Helper method to organize form data into sections for display
  private static organizeFormDataIntoSections(formData: any, verificationType: string, formType?: string): FormSection[] {


    // If we have form type, use comprehensive mapping
    if (formType) {
      try {
        const sections = createComprehensiveFormSections(formData, verificationType, formType);
        return sections;
      } catch (error) {
        console.error('Error creating comprehensive form sections:', error);
        // Fall through to basic sections
      }
    }

    // Fallback to basic form sections
    return this.createBasicFormSections(formData, verificationType);
  }

  // Fallback method for basic form sections
  private static createBasicFormSections(formData: any, verificationType: string): FormSection[] {
    const sections: FormSection[] = [];

    // Customer Information Section
    if (formData.customerName || formData.bankName || formData.product) {
      sections.push({
        id: 'customer_info',
        title: 'Customer Information',
        order: 1,
        isRequired: true,
        defaultExpanded: true,
        fields: [
          { id: 'customerName', name: 'customerName', label: 'Customer Name', type: 'text' as const, value: formData.customerName, isRequired: true, displayValue: formData.customerName },
          { id: 'bankName', name: 'bankName', label: 'Bank Name', type: 'text' as const, value: formData.bankName, isRequired: false, displayValue: formData.bankName },
          { id: 'product', name: 'product', label: 'Product', type: 'text' as const, value: formData.product, isRequired: false, displayValue: formData.product },
        ].filter(field => field.value !== undefined && field.value !== null && field.value !== ''),
      });
    }

    // Address Verification Section
    if (formData.addressLocatable || formData.addressRating || formData.houseStatus) {
      sections.push({
        id: 'address_verification',
        title: 'Address Verification',
        order: 2,
        isRequired: true,
        defaultExpanded: true,
        fields: [
          { id: 'addressLocatable', name: 'addressLocatable', label: 'Address Locatable', type: 'select' as const, value: formData.addressLocatable, isRequired: true, displayValue: formData.addressLocatable },
          { id: 'addressRating', name: 'addressRating', label: 'Address Rating', type: 'select' as const, value: formData.addressRating, isRequired: true, displayValue: formData.addressRating },
          { id: 'houseStatus', name: 'houseStatus', label: 'House Status', type: 'select' as const, value: formData.houseStatus, isRequired: true, displayValue: formData.houseStatus },
        ].filter(field => field.value !== undefined && field.value !== null && field.value !== ''),
      });
    }

    // Personal Details Section (for residence verification)
    if (verificationType === 'RESIDENCE' && (formData.metPersonName || formData.relation || formData.totalFamilyMembers)) {
      sections.push({
        id: 'personal_details',
        title: 'Personal Details',
        order: 3,
        isRequired: true,
        defaultExpanded: true,
        fields: [
          { id: 'metPersonName', name: 'metPersonName', label: 'Met Person Name', type: 'text' as const, value: formData.metPersonName, isRequired: true, displayValue: formData.metPersonName },
          { id: 'relation', name: 'relation', label: 'Relation', type: 'select' as const, value: formData.relation, isRequired: true, displayValue: formData.relation },
          { id: 'totalFamilyMembers', name: 'totalFamilyMembers', label: 'Total Family Members', type: 'number' as const, value: formData.totalFamilyMembers, isRequired: true, displayValue: formData.totalFamilyMembers?.toString() },
          { id: 'totalEarning', name: 'totalEarning', label: 'Total Earning (₹)', type: 'number' as const, value: formData.totalEarning, isRequired: false, displayValue: formData.totalEarning ? `₹${formData.totalEarning}` : undefined },
          { id: 'workingStatus', name: 'workingStatus', label: 'Working Status', type: 'select' as const, value: formData.workingStatus, isRequired: false, displayValue: formData.workingStatus },
          { id: 'companyName', name: 'companyName', label: 'Company Name', type: 'text' as const, value: formData.companyName, isRequired: false, displayValue: formData.companyName },
        ].filter(field => field.value !== undefined && field.value !== null && field.value !== ''),
      });
    }

    // Property Details Section
    if (formData.locality || formData.addressStructure || formData.doorColor) {
      sections.push({
        id: 'property_details',
        title: 'Property Details',
        order: 4,
        isRequired: false,
        defaultExpanded: false,
        fields: [
          { id: 'locality', name: 'locality', label: 'Locality', type: 'select' as const, value: formData.locality, isRequired: false, displayValue: formData.locality },
          { id: 'addressStructure', name: 'addressStructure', label: 'Address Structure', type: 'select' as const, value: formData.addressStructure, isRequired: false, displayValue: formData.addressStructure },
          { id: 'doorColor', name: 'doorColor', label: 'Door Color', type: 'text' as const, value: formData.doorColor, isRequired: false, displayValue: formData.doorColor },
          { id: 'doorNamePlate', name: 'doorNamePlate', label: 'Door Name Plate', type: 'select' as const, value: formData.doorNamePlate, isRequired: false, displayValue: formData.doorNamePlate },
          { id: 'nameOnDoorPlate', name: 'nameOnDoorPlate', label: 'Name on Door Plate', type: 'text' as const, value: formData.nameOnDoorPlate, isRequired: false, displayValue: formData.nameOnDoorPlate },
        ].filter(field => field.value !== undefined && field.value !== null && field.value !== ''),
      });
    }

    // Final Status Section
    if (formData.finalStatus || formData.outcome) {
      sections.push({
        id: 'final_status',
        title: 'Final Status',
        order: 10,
        isRequired: true,
        defaultExpanded: true,
        fields: [
          { id: 'finalStatus', name: 'finalStatus', label: 'Final Status', type: 'select' as const, value: formData.finalStatus, isRequired: true, displayValue: formData.finalStatus },
          { id: 'outcome', name: 'outcome', label: 'Outcome', type: 'select' as const, value: formData.outcome, isRequired: false, displayValue: formData.outcome },
          { id: 'otherObservation', name: 'otherObservation', label: 'Other Observation', type: 'textarea' as const, value: formData.otherObservation, isRequired: false, displayValue: formData.otherObservation },
        ].filter(field => field.value !== undefined && field.value !== null && field.value !== ''),
      });
    }

    return sections.filter(section => section.fields.length > 0);
  }

  // Create comprehensive form sections from database report data
  private static createComprehensiveFormSectionsFromReport(
    report: any,
    verificationType: string,
    formType: string
  ): FormSection[] {
    console.log(`Creating comprehensive sections from report for ${verificationType} - ${formType}`);

    try {
      // Convert database report to form data format
      const formData = MobileFormController.convertReportToFormData(report, verificationType);

      // Use comprehensive form field mapping
      const sections = createComprehensiveFormSections(formData, verificationType, formType);
      console.log(`Generated ${sections.length} comprehensive sections from report`);
      return sections;
    } catch (error) {
      console.error('Error creating comprehensive sections from report:', error);

      // Fallback to basic sections
      return MobileFormController.createBasicFormSectionsFromReport(report, verificationType);
    }
  }

  // Convert database report to form data format
  private static convertReportToFormData(report: any, verificationType: string): any {
    console.log(`Converting report to form data for ${verificationType}:`, Object.keys(report));
    const formData: any = {};

    // Map common fields
    formData.customerName = report.customer_name;
    formData.outcome = report.verification_outcome;
    formData.finalStatus = report.final_status;
    formData.metPersonName = report.met_person_name;
    formData.callRemark = report.call_remark;

    // Map location fields
    formData.addressLocatable = report.address_locatable;
    formData.addressRating = report.address_rating;
    formData.locality = report.locality;
    formData.addressStructure = report.address_structure;
    formData.landmark1 = report.landmark1;
    formData.landmark2 = report.landmark2;
    formData.landmark3 = report.landmark3;
    formData.landmark4 = report.landmark4;

    // Map area assessment fields
    formData.politicalConnection = report.political_connection;
    formData.dominatedArea = report.dominated_area;
    formData.feedbackFromNeighbour = report.feedback_from_neighbour;
    formData.otherObservation = report.other_observation;

    // Map verification type specific fields
    if (verificationType === 'RESIDENCE') {
      formData.houseStatus = report.house_status;
      formData.metPersonRelation = report.met_person_relation;
      formData.metPersonStatus = report.met_person_status;
      formData.totalFamilyMembers = report.total_family_members;
      formData.totalEarning = report.total_earning;
      formData.workingStatus = report.working_status;
      formData.companyName = report.company_name;
      formData.stayingPeriod = report.staying_period;
      formData.stayingStatus = report.staying_status;
      formData.documentShownStatus = report.document_shown_status;
      formData.documentType = report.document_type;
      formData.doorColor = report.door_color;
      formData.doorNamePlateStatus = report.door_nameplate_status;
      formData.nameOnDoorPlate = report.name_on_door_plate;
      formData.societyNamePlateStatus = report.society_nameplate_status;
      formData.nameOnSocietyBoard = report.name_on_society_board;
      formData.addressStructureColor = report.address_structure_color;
      formData.addressFloor = report.address_floor;

      // TPC (Third Party Confirmation) fields
      formData.tpcMetPerson1 = report.tpc_met_person1;
      formData.tpcName1 = report.tpc_name1;
      formData.tpcConfirmation1 = report.tpc_confirmation1;
      formData.tpcMetPerson2 = report.tpc_met_person2;
      formData.tpcName2 = report.tpc_name2;
      formData.tpcConfirmation2 = report.tpc_confirmation2;

      // Form type specific fields
      formData.shiftedPeriod = report.shifted_period;
      formData.currentLocation = report.current_location;
      formData.premisesStatus = report.premises_status;
      formData.roomStatus = report.room_status;
      formData.stayingPersonName = report.staying_person_name;
      formData.entryRestrictionReason = report.entry_restriction_reason;
      formData.securityPersonName = report.security_person_name;
      formData.accessDenied = report.access_denied;
      formData.nameOfMetPerson = report.name_of_met_person;
      formData.metPersonType = report.met_person_type;
      formData.applicantStayingStatus = report.applicant_staying_status;
      formData.contactPerson = report.contact_person;
      formData.alternateContact = report.alternate_contact;
    } else if (verificationType === 'OFFICE') {
      formData.designation = report.designation;
      formData.applicantDesignation = report.applicant_designation;
      formData.officeStatus = report.office_status;
      formData.officeType = report.office_type;
      formData.companyNatureOfBusiness = report.company_nature_of_business;
      formData.businessPeriod = report.business_period;
      formData.establishmentPeriod = report.establishment_period;
      formData.staffStrength = report.staff_strength;
      formData.staffSeen = report.staff_seen;
      formData.workingPeriod = report.working_period;
      formData.workingStatus = report.working_status;
      formData.officeApproxArea = report.office_approx_area;
      formData.documentShown = report.document_shown;
      formData.documentType = report.document_type;
      formData.addressFloor = report.address_floor;
      formData.companyNamePlateStatus = report.company_nameplate_status;
      formData.nameOnCompanyBoard = report.name_on_company_board;
      formData.tpcMetPerson1 = report.tpc_met_person1;
      formData.tpcName1 = report.tpc_name1;
      formData.tpcConfirmation1 = report.tpc_confirmation1;
      formData.tpcMetPerson2 = report.tpc_met_person2;
      formData.tpcName2 = report.tpc_name2;
      formData.tpcConfirmation2 = report.tpc_confirmation2;
    } else if (verificationType === 'BUSINESS') {
      // Basic Information
      formData.designation = report.designation;
      formData.applicantDesignation = report.applicant_designation;

      // Business Details
      formData.businessStatus = report.business_status;
      formData.businessType = report.business_type;
      formData.companyNatureOfBusiness = report.company_nature_of_business;
      formData.businessPeriod = report.business_period;
      formData.establishmentPeriod = report.establishment_period;
      formData.businessExistence = report.business_existence;
      formData.businessActivity = report.business_activity;
      formData.businessSetup = report.business_setup;
      formData.businessApproxArea = report.business_approx_area;
      formData.staffStrength = report.staff_strength;
      formData.staffSeen = report.staff_seen;
      formData.ownershipType = report.ownership_type;
      formData.ownerName = report.owner_name;
      formData.businessOwnerName = report.business_owner_name;
      formData.nameOfCompanyOwners = report.name_of_company_owners;

      // Working Details
      formData.workingPeriod = report.working_period;
      formData.workingStatus = report.working_status;
      formData.applicantWorkingPremises = report.applicant_working_premises;
      formData.applicantWorkingStatus = report.applicant_working_status;

      // Document Verification
      formData.documentShown = report.document_shown;
      formData.documentType = report.document_type;

      // Location Details
      formData.addressFloor = report.address_floor;
      formData.addressStatus = report.address_status;
      formData.premisesStatus = report.premises_status;
      formData.companyNamePlateStatus = report.company_nameplate_status;
      formData.nameOnCompanyBoard = report.name_on_company_board;

      // TPC Details
      formData.tpcMetPerson1 = report.tpc_met_person1;
      formData.tpcName1 = report.tpc_name1;
      formData.tpcConfirmation1 = report.tpc_confirmation1;
      formData.tpcMetPerson2 = report.tpc_met_person2;
      formData.tpcName2 = report.tpc_name2;
      formData.tpcConfirmation2 = report.tpc_confirmation2;
      formData.nameOfTpc1 = report.name_of_tpc1;
      formData.nameOfTpc2 = report.name_of_tpc2;

      // Shifting Details
      formData.shiftedPeriod = report.shifted_period;
      formData.oldBusinessShiftedPeriod = report.old_business_shifted_period;
      formData.currentCompanyName = report.current_company_name;
      formData.currentCompanyPeriod = report.current_company_period;

      // Contact & Communication
      formData.contactPerson = report.contact_person;
      formData.callRemark = report.call_remark;
      formData.nameOfMetPerson = report.name_of_met_person;
      formData.metPersonType = report.met_person_type;
      formData.metPersonConfirmation = report.met_person_confirmation;

      // Area Assessment
      formData.otherExtraRemark = report.other_extra_remark;
      formData.holdReason = report.hold_reason;
      formData.recommendationStatus = report.recommendation_status;
    } else if (verificationType === 'PROPERTY_APF') {
      // Basic Information
      formData.customerName = report.customer_name;
      formData.metPersonName = report.met_person_name;
      formData.metPersonDesignation = report.met_person_designation;
      formData.metPersonRelation = report.met_person_relation;
      formData.metPersonContact = report.met_person_contact;

      // Address Information
      formData.fullAddress = report.full_address;
      formData.locality = report.locality;
      formData.addressLocatable = report.address_locatable;
      formData.addressRating = report.address_rating;
      formData.addressStructure = report.address_structure;
      formData.addressStructureColor = report.address_structure_color;
      formData.addressFloor = report.address_floor;
      formData.doorColor = report.door_color;
      formData.landmark1 = report.landmark1;
      formData.landmark2 = report.landmark2;
      formData.landmark3 = report.landmark3;
      formData.landmark4 = report.landmark4;

      // Property Details
      formData.propertyType = report.property_type;
      formData.propertyStatus = report.property_status;
      formData.propertyOwnership = report.property_ownership;
      formData.propertyAge = report.property_age;
      formData.propertyCondition = report.property_condition;
      formData.propertyArea = report.property_area;
      formData.propertyValue = report.property_value;
      formData.marketValue = report.market_value;
      formData.buildingStatus = report.building_status;
      formData.constructionActivity = report.construction_activity;

      // APF Details
      formData.apfStatus = report.apf_status;
      formData.apfNumber = report.apf_number;
      formData.apfIssueDate = report.apf_issue_date;
      formData.apfExpiryDate = report.apf_expiry_date;
      formData.apfIssuingAuthority = report.apf_issuing_authority;
      formData.apfValidityStatus = report.apf_validity_status;
      formData.apfAmount = report.apf_amount;
      formData.apfUtilizedAmount = report.apf_utilized_amount;
      formData.apfBalanceAmount = report.apf_balance_amount;

      // Project Information
      formData.projectName = report.project_name;
      formData.projectStatus = report.project_status;
      formData.projectApprovalStatus = report.project_approval_status;
      formData.projectCompletionPercentage = report.project_completion_percentage;
      formData.projectStartDate = report.project_start_date;
      formData.projectEndDate = report.project_end_date;
      formData.projectStartedDate = report.project_started_date;
      formData.projectCompletionDate = report.project_completion_date;
      formData.totalUnits = report.total_units;
      formData.completedUnits = report.completed_units;
      formData.soldUnits = report.sold_units;
      formData.availableUnits = report.available_units;
      formData.possessionStatus = report.possession_status;
      formData.totalBuildingsInProject = report.total_buildings_in_project;
      formData.totalFlats = report.total_flats;
      formData.totalFlatsInBuilding = report.total_flats_in_building;
      formData.totalWing = report.total_wing;

      // Staff Information
      formData.staffSeen = report.staff_seen;
      formData.staffStrength = report.staff_strength;

      // Name Plates & Boards
      formData.companyNameBoard = report.company_name_board;
      formData.nameOnBoard = report.name_on_board;

      // Document Verification
      formData.documentShownStatus = report.document_shown_status;
      formData.documentType = report.document_type;
      formData.documentVerificationStatus = report.document_verification_status;

      // Third Party Confirmation
      formData.tpcMetPerson1 = report.tpc_met_person1;
      formData.tpcName1 = report.tpc_name1;
      formData.tpcConfirmation1 = report.tpc_confirmation1;
      formData.tpcMetPerson2 = report.tpc_met_person2;
      formData.tpcName2 = report.tpc_name2;
      formData.tpcConfirmation2 = report.tpc_confirmation2;

      // Builder Information
      formData.builderName = report.builder_name;
      formData.builderContact = report.builder_contact;
      formData.developerName = report.developer_name;
      formData.developerContact = report.developer_contact;
      formData.builderRegistrationNumber = report.builder_registration_number;
      formData.reraRegistrationNumber = report.rera_registration_number;

      // Loan Information
      formData.loanAmount = report.loan_amount;
      formData.loanPurpose = report.loan_purpose;
      formData.loanStatus = report.loan_status;
      formData.bankName = report.bank_name;
      formData.loanAccountNumber = report.loan_account_number;
      formData.emiAmount = report.emi_amount;

      // Legal & Clearance
      formData.legalClearance = report.legal_clearance;
      formData.titleClearance = report.title_clearance;
      formData.encumbranceStatus = report.encumbrance_status;
      formData.litigationStatus = report.litigation_status;

      // Shifting & Contact Details
      formData.shiftedPeriod = report.shifted_period;
      formData.currentLocation = report.current_location;
      formData.premisesStatus = report.premises_status;
      formData.entryRestrictionReason = report.entry_restriction_reason;
      formData.securityPersonName = report.security_person_name;
      formData.securityConfirmation = report.security_confirmation;
      formData.contactPerson = report.contact_person;
      formData.callRemark = report.call_remark;

      // Infrastructure & Area Assessment
      formData.infrastructureStatus = report.infrastructure_status;
      formData.roadConnectivity = report.road_connectivity;
      formData.politicalConnection = report.political_connection;
      formData.dominatedArea = report.dominated_area;
      formData.feedbackFromNeighbour = report.feedback_from_neighbour;
      formData.otherObservation = report.other_observation;
      formData.propertyConcerns = report.property_concerns;
      formData.financialConcerns = report.financial_concerns;
      formData.finalStatus = report.final_status;
      formData.holdReason = report.hold_reason;
      formData.recommendationStatus = report.recommendation_status;
      formData.remarks = report.remarks;
      formData.metPersonDesignation = report.met_person_designation;
      formData.metPersonRelation = report.met_person_relation;
      formData.metPersonContact = report.met_person_contact;
      formData.documentShownStatus = report.document_shown_status;
      formData.documentType = report.document_type;
      formData.documentVerificationStatus = report.document_verification_status;
      formData.tpcMetPerson1 = report.tpc_met_person1;
      formData.tpcName1 = report.tpc_name1;
      formData.tpcConfirmation1 = report.tpc_confirmation1;
      formData.tpcMetPerson2 = report.tpc_met_person2;
      formData.tpcName2 = report.tpc_name2;
      formData.tpcConfirmation2 = report.tpc_confirmation2;
      formData.shiftedPeriod = report.shifted_period;
      formData.currentLocation = report.current_location;
      formData.premisesStatus = report.premises_status;
      formData.entryRestrictionReason = report.entry_restriction_reason;
      formData.securityPersonName = report.security_person_name;
      formData.securityConfirmation = report.security_confirmation;
      formData.contactPerson = report.contact_person;
      formData.callRemark = report.call_remark;
      formData.legalClearance = report.legal_clearance;
      formData.titleClearance = report.title_clearance;
      formData.encumbranceStatus = report.encumbrance_status;
      formData.litigationStatus = report.litigation_status;
      formData.infrastructureStatus = report.infrastructure_status;
      formData.roadConnectivity = report.road_connectivity;
      formData.propertyConcerns = report.property_concerns;
      formData.financialConcerns = report.financial_concerns;
      formData.recommendationStatus = report.recommendation_status;
      formData.doorColor = report.door_color;
      formData.holdReason = report.hold_reason;
    } else if (verificationType === 'PROPERTY_INDIVIDUAL') {
      // Basic Information
      formData.customerName = report.customer_name;
      formData.metPersonName = report.met_person_name;
      formData.metPersonDesignation = report.met_person_designation;
      formData.metPersonRelation = report.met_person_relation;
      formData.metPersonContact = report.met_person_contact;

      // Address Information
      formData.fullAddress = report.full_address;
      formData.locality = report.locality;
      formData.addressLocatable = report.address_locatable;
      formData.addressRating = report.address_rating;
      formData.addressStructure = report.address_structure;
      formData.addressStructureColor = report.address_structure_color;
      formData.addressFloor = report.address_floor;
      formData.doorColor = report.door_color;
      formData.landmark1 = report.landmark1;
      formData.landmark2 = report.landmark2;
      formData.landmark3 = report.landmark3;
      formData.landmark4 = report.landmark4;

      // Property Details
      formData.propertyType = report.property_type;
      formData.propertyStatus = report.property_status;
      formData.propertyOwnership = report.property_ownership;
      formData.propertyAge = report.property_age;
      formData.propertyCondition = report.property_condition;
      formData.propertyArea = report.property_area;
      formData.propertyValue = report.property_value;
      formData.marketValue = report.market_value;
      formData.propertyLocation = report.property_location;
      formData.propertyDescription = report.property_description;
      formData.propertyAmenities = report.property_amenities;
      formData.constructionType = report.construction_type;
      formData.constructionYear = report.construction_year;
      formData.renovationYear = report.renovation_year;

      // Owner Information
      formData.ownerName = report.owner_name;
      formData.ownerAge = report.owner_age;
      formData.ownerOccupation = report.owner_occupation;
      formData.ownerIncome = report.owner_income;
      formData.ownerRelation = report.owner_relation;
      formData.previousOwnerName = report.previous_owner_name;

      // Individual Information
      formData.individualName = report.individual_name;
      formData.individualAge = report.individual_age;
      formData.individualOccupation = report.individual_occupation;
      formData.individualEducation = report.individual_education;
      formData.individualMaritalStatus = report.individual_marital_status;
      formData.individualExperience = report.individual_experience;
      formData.individualIncome = report.individual_income;
      formData.yearsOfResidence = report.years_of_residence;

      // Family & Employment
      formData.familyMembers = report.family_members;
      formData.earningMembers = report.earning_members;
      formData.employmentType = report.employment_type;
      formData.employerName = report.employer_name;
      formData.employmentDuration = report.employment_duration;
      formData.incomeSource = report.income_source;
      formData.monthlyIncome = report.monthly_income;
      formData.annualIncome = report.annual_income;

      // Business Information
      formData.businessName = report.business_name;
      formData.businessType = report.business_type;
      formData.businessIncome = report.business_income;
      formData.businessExperience = report.business_experience;

      // Financial Information
      formData.loanAmount = report.loan_amount;
      formData.emiAmount = report.emi_amount;
      formData.bankName = report.bank_name;
      formData.loanAgainstProperty = report.loan_against_property;

      // Legal & Documentation
      formData.propertyDocuments = report.property_documents;
      formData.documentVerificationStatus = report.document_verification_status;
      formData.titleClearStatus = report.title_clear_status;
      formData.mutationStatus = report.mutation_status;
      formData.taxPaymentStatus = report.tax_payment_status;
      formData.legalIssues = report.legal_issues;

      // Utilities & Amenities
      formData.electricityConnection = report.electricity_connection;
      formData.waterConnection = report.water_connection;
      formData.gasConnection = report.gas_connection;
      formData.internetConnection = report.internet_connection;
      formData.publicTransport = report.public_transport;
      formData.roadConnectivity = report.road_connectivity;
      formData.safetySecurity = report.safety_security;

      // Third Party Confirmation
      formData.tpcMetPerson1 = report.tpc_met_person1;
      formData.tpcName1 = report.tpc_name1;
      formData.tpcConfirmation1 = report.tpc_confirmation1;
      formData.tpcMetPerson2 = report.tpc_met_person2;
      formData.tpcName2 = report.tpc_name2;
      formData.tpcConfirmation2 = report.tpc_confirmation2;
      formData.neighbor1Name = report.neighbor1_name;
      formData.neighbor1Confirmation = report.neighbor1_confirmation;
      formData.neighbor2Name = report.neighbor2_name;
      formData.neighbor2Confirmation = report.neighbor2_confirmation;

      // Shifting & Contact Details
      formData.shiftedPeriod = report.shifted_period;
      formData.currentLocation = report.current_location;
      formData.premisesStatus = report.premises_status;
      formData.entryRestrictionReason = report.entry_restriction_reason;
      formData.securityPersonName = report.security_person_name;
      formData.securityConfirmation = report.security_confirmation;
      formData.contactPerson = report.contact_person;
      formData.callRemark = report.call_remark;

      // Area Assessment & Reputation
      formData.localityReputation = report.locality_reputation;
      formData.infrastructureStatus = report.infrastructure_status;
      formData.politicalConnection = report.political_connection;
      formData.dominatedArea = report.dominated_area;
      formData.feedbackFromNeighbour = report.feedback_from_neighbour;
      formData.otherObservation = report.other_observation;
      formData.propertyConcerns = report.property_concerns;
      formData.verificationChallenges = report.verification_challenges;
      formData.finalStatus = report.final_status;
      formData.holdReason = report.hold_reason;
      formData.recommendationStatus = report.recommendation_status;
      formData.remarks = report.remarks;
    } else if (verificationType === 'NOC') {
      // Basic Information
      formData.customerName = report.customer_name;
      formData.metPersonName = report.met_person_name;
      formData.metPersonDesignation = report.met_person_designation;
      formData.metPersonRelation = report.met_person_relation;
      formData.metPersonContact = report.met_person_contact;

      // Address Information
      formData.fullAddress = report.full_address;
      formData.locality = report.locality;
      formData.addressLocatable = report.address_locatable;
      formData.addressRating = report.address_rating;
      formData.addressStructure = report.address_structure;
      formData.addressStructureColor = report.address_structure_color;
      formData.addressFloor = report.address_floor;
      formData.doorColor = report.door_color;
      formData.landmark1 = report.landmark1;
      formData.landmark2 = report.landmark2;
      formData.landmark3 = report.landmark3;
      formData.landmark4 = report.landmark4;

      // NOC Information
      formData.nocType = report.noc_type;
      formData.nocStatus = report.noc_status;
      formData.nocNumber = report.noc_number;
      formData.nocIssueDate = report.noc_issue_date;
      formData.nocExpiryDate = report.noc_expiry_date;
      formData.nocIssuingAuthority = report.noc_issuing_authority;
      formData.nocValidityStatus = report.noc_validity_status;

      // Property & Project Information
      formData.propertyType = report.property_type;
      formData.projectName = report.project_name;
      formData.projectStatus = report.project_status;
      formData.constructionStatus = report.construction_status;
      formData.projectApprovalStatus = report.project_approval_status;
      formData.totalUnits = report.total_units;
      formData.completedUnits = report.completed_units;
      formData.soldUnits = report.sold_units;
      formData.possessionStatus = report.possession_status;

      // Builder & Developer Information
      formData.builderName = report.builder_name;
      formData.builderContact = report.builder_contact;
      formData.developerName = report.developer_name;
      formData.developerContact = report.developer_contact;
      formData.builderRegistrationNumber = report.builder_registration_number;

      // Document Verification
      formData.documentShownStatus = report.document_shown_status;
      formData.documentType = report.document_type;
      formData.documentVerificationStatus = report.document_verification_status;

      // Third Party Confirmation
      formData.tpcMetPerson1 = report.tpc_met_person1;
      formData.tpcName1 = report.tpc_name1;
      formData.tpcConfirmation1 = report.tpc_confirmation1;
      formData.tpcMetPerson2 = report.tpc_met_person2;
      formData.tpcName2 = report.tpc_name2;
      formData.tpcConfirmation2 = report.tpc_confirmation2;

      // Shifting & Contact Details
      formData.shiftedPeriod = report.shifted_period;
      formData.currentLocation = report.current_location;
      formData.premisesStatus = report.premises_status;
      formData.entryRestrictionReason = report.entry_restriction_reason;
      formData.securityPersonName = report.security_person_name;
      formData.securityConfirmation = report.security_confirmation;
      formData.contactPerson = report.contact_person;
      formData.callRemark = report.call_remark;

      // Clearances & Compliance
      formData.environmentalClearance = report.environmental_clearance;
      formData.fireSafetyClearance = report.fire_safety_clearance;
      formData.pollutionClearance = report.pollution_clearance;
      formData.waterConnectionStatus = report.water_connection_status;
      formData.electricityConnectionStatus = report.electricity_connection_status;
      formData.complianceIssues = report.compliance_issues;
      formData.regulatoryConcerns = report.regulatory_concerns;

      // Infrastructure & Assessment
      formData.infrastructureStatus = report.infrastructure_status;
      formData.roadConnectivity = report.road_connectivity;
      formData.politicalConnection = report.political_connection;
      formData.dominatedArea = report.dominated_area;
      formData.feedbackFromNeighbour = report.feedback_from_neighbour;
      formData.otherObservation = report.other_observation;

      // Final Status & Recommendations
      formData.finalStatus = report.final_status;
      formData.holdReason = report.hold_reason;
      formData.recommendationStatus = report.recommendation_status;
      formData.remarks = report.remarks;
    } else if (verificationType === 'BUILDER') {
      // Basic Information
      formData.customerName = report.customer_name;
      formData.metPersonName = report.met_person_name;
      formData.designation = report.designation;
      formData.applicantDesignation = report.applicant_designation;

      // Address Information
      formData.fullAddress = report.full_address;
      formData.locality = report.locality;
      formData.addressLocatable = report.address_locatable;
      formData.addressRating = report.address_rating;
      formData.addressStructure = report.address_structure;
      formData.addressStructureColor = report.address_structure_color;
      formData.addressFloor = report.address_floor;
      formData.doorColor = report.door_color;
      formData.landmark1 = report.landmark1;
      formData.landmark2 = report.landmark2;
      formData.landmark3 = report.landmark3;
      formData.landmark4 = report.landmark4;

      // Builder Information
      formData.builderName = report.builder_name;
      formData.builderOwnerName = report.builder_owner_name;
      formData.builderType = report.builder_type;
      formData.companyNatureOfBusiness = report.company_nature_of_business;
      formData.businessPeriod = report.business_period;
      formData.establishmentPeriod = report.establishment_period;
      formData.workingPeriod = report.working_period;
      formData.workingStatus = report.working_status;
      formData.applicantWorkingStatus = report.applicant_working_status;

      // Office Information
      formData.officeStatus = report.office_status;
      formData.officeExistence = report.office_existence;
      formData.officeApproxArea = report.office_approx_area;
      formData.companyNameplateStatus = report.company_nameplate_status;
      formData.nameOnCompanyBoard = report.name_on_company_board;

      // Staff Information
      formData.staffStrength = report.staff_strength;
      formData.staffSeen = report.staff_seen;

      // Document Verification
      formData.documentShown = report.document_shown;

      // Third Party Confirmation
      formData.tpcMetPerson1 = report.tpc_met_person1;
      formData.tpcName1 = report.tpc_name1;
      formData.tpcConfirmation1 = report.tpc_confirmation1;
      formData.tpcMetPerson2 = report.tpc_met_person2;
      formData.tpcName2 = report.tpc_name2;
      formData.tpcConfirmation2 = report.tpc_confirmation2;
      formData.nameOfMetPerson = report.name_of_met_person;
      formData.metPersonType = report.met_person_type;
      formData.metPersonConfirmation = report.met_person_confirmation;

      // Shifting & Contact Details
      formData.shiftedPeriod = report.shifted_period;
      formData.oldOfficeShiftedPeriod = report.old_office_shifted_period;
      formData.currentCompanyName = report.current_company_name;
      formData.currentCompanyPeriod = report.current_company_period;
      formData.premisesStatus = report.premises_status;
      formData.contactPerson = report.contact_person;
      formData.callRemark = report.call_remark;

      // Assessment & Feedback
      formData.politicalConnection = report.political_connection;
      formData.dominatedArea = report.dominated_area;
      formData.feedbackFromNeighbour = report.feedback_from_neighbour;
      formData.otherObservation = report.other_observation;
      formData.otherExtraRemark = report.other_extra_remark;

      // Final Status & Recommendations
      formData.finalStatus = report.final_status;
      formData.holdReason = report.hold_reason;
      formData.recommendationStatus = report.recommendation_status;
      formData.remarks = report.remarks;
    } else if (verificationType === 'DSA_CONNECTOR' || verificationType === 'CONNECTOR') {
      // Basic Information
      formData.customerName = report.customer_name;
      formData.metPersonName = report.met_person_name;
      formData.metPersonDesignation = report.met_person_designation;
      formData.metPersonRelation = report.met_person_relation;
      formData.metPersonContact = report.met_person_contact;

      // Address Information
      formData.fullAddress = report.full_address;
      formData.locality = report.locality;
      formData.addressLocatable = report.address_locatable;
      formData.addressRating = report.address_rating;
      formData.addressStructure = report.address_structure;
      formData.addressStructureColor = report.address_structure_color;
      formData.addressFloor = report.address_floor;
      formData.doorColor = report.door_color;
      formData.landmark1 = report.landmark1;
      formData.landmark2 = report.landmark2;
      formData.landmark3 = report.landmark3;
      formData.landmark4 = report.landmark4;

      // Connector Information
      formData.connectorType = report.connector_type;
      formData.connectorCode = report.connector_code;
      formData.connectorName = report.connector_name;
      formData.connectorDesignation = report.connector_designation;
      formData.connectorExperience = report.connector_experience;
      formData.connectorStatus = report.connector_status;

      // Business Information
      formData.businessName = report.business_name;
      formData.businessType = report.business_type;
      formData.businessRegistrationNumber = report.business_registration_number;
      formData.businessEstablishmentYear = report.business_establishment_year;
      formData.businessOperational = report.business_operational;
      formData.businessHours = report.business_hours;
      formData.weekendOperations = report.weekend_operations;
      formData.customerFootfall = report.customer_footfall;
      formData.previousBusinessName = report.previous_business_name;

      // Office Information
      formData.officeType = report.office_type;
      formData.officeArea = report.office_area;
      formData.officeRent = report.office_rent;

      // Staff Information
      formData.totalStaff = report.total_staff;
      formData.salesStaff = report.sales_staff;
      formData.supportStaff = report.support_staff;
      formData.teamSize = report.team_size;

      // Financial Information
      formData.monthlyBusinessVolume = report.monthly_business_volume;
      formData.averageMonthlySales = report.average_monthly_sales;
      formData.annualTurnover = report.annual_turnover;
      formData.monthlyIncome = report.monthly_income;
      formData.commissionStructure = report.commission_structure;
      formData.paymentTerms = report.payment_terms;
      formData.bankAccountDetails = report.bank_account_details;

      // Technology & Infrastructure
      formData.computerSystems = report.computer_systems;
      formData.internetConnection = report.internet_connection;
      formData.softwareSystems = report.software_systems;
      formData.posTerminals = report.pos_terminals;
      formData.printerScanner = report.printer_scanner;
      formData.infrastructureStatus = report.infrastructure_status;

      // Compliance & Licensing
      formData.licenseStatus = report.license_status;
      formData.licenseNumber = report.license_number;
      formData.licenseExpiryDate = report.license_expiry_date;
      formData.complianceStatus = report.compliance_status;
      formData.auditStatus = report.audit_status;
      formData.trainingStatus = report.training_status;

      // Third Party Confirmation
      formData.tpcMetPerson1 = report.tpc_met_person1;
      formData.tpcName1 = report.tpc_name1;
      formData.tpcConfirmation1 = report.tpc_confirmation1;
      formData.tpcMetPerson2 = report.tpc_met_person2;
      formData.tpcName2 = report.tpc_name2;
      formData.tpcConfirmation2 = report.tpc_confirmation2;

      // Shifting & Contact Details
      formData.shiftedPeriod = report.shifted_period;
      formData.currentLocation = report.current_location;
      formData.premisesStatus = report.premises_status;
      formData.entryRestrictionReason = report.entry_restriction_reason;
      formData.securityPersonName = report.security_person_name;
      formData.securityConfirmation = report.security_confirmation;
      formData.contactPerson = report.contact_person;
      formData.callRemark = report.call_remark;

      // Market Analysis & Assessment
      formData.marketPresence = report.market_presence;
      formData.competitorAnalysis = report.competitor_analysis;
      formData.marketReputation = report.market_reputation;
      formData.customerFeedback = report.customer_feedback;
      formData.commercialViability = report.commercial_viability;
      formData.growthPotential = report.growth_potential;

      // Risk Assessment & Final Status
      formData.politicalConnection = report.political_connection;
      formData.dominatedArea = report.dominated_area;
      formData.feedbackFromNeighbour = report.feedback_from_neighbour;
      formData.otherObservation = report.other_observation;
      formData.businessConcerns = report.business_concerns;
      formData.operationalChallenges = report.operational_challenges;
      formData.riskAssessment = report.risk_assessment;
      formData.finalStatus = report.final_status;
      formData.holdReason = report.hold_reason;
      formData.recommendationStatus = report.recommendation_status;
      formData.remarks = report.remarks;
    } else if (verificationType === 'RESIDENCE_CUM_OFFICE' || verificationType === 'Residence-cum-office') {
      // Basic Information
      formData.customerName = report.customer_name;
      formData.metPersonName = report.met_person_name;
      formData.metPersonRelation = report.met_person_relation;
      formData.designation = report.designation;
      formData.applicantDesignation = report.applicant_designation;

      // Address Information
      formData.fullAddress = report.full_address;
      formData.locality = report.locality;
      formData.addressLocatable = report.address_locatable;
      formData.addressRating = report.address_rating;
      formData.addressStructure = report.address_structure;
      formData.addressStructureColor = report.address_structure_color;
      formData.addressFloor = report.address_floor;
      formData.doorColor = report.door_color;
      formData.landmark1 = report.landmark1;
      formData.landmark2 = report.landmark2;
      formData.landmark3 = report.landmark3;
      formData.landmark4 = report.landmark4;

      // Residence Information
      formData.houseStatus = report.house_status;
      formData.totalFamilyMembers = report.total_family_members;
      formData.totalEarning = report.total_earning;
      formData.stayingPeriod = report.staying_period;
      formData.stayingStatus = report.staying_status;
      formData.stayingPersonName = report.staying_person_name;
      formData.doorNameplateStatus = report.door_nameplate_status;
      formData.nameOnDoorPlate = report.name_on_door_plate;
      formData.societyNameplateStatus = report.society_nameplate_status;
      formData.nameOnSocietyBoard = report.name_on_society_board;

      // Applicant Information
      formData.applicantAge = report.applicant_age;
      formData.applicantDob = report.applicant_dob;
      formData.applicantStayingStatus = report.applicant_staying_status;
      formData.applicantWorkingStatus = report.applicant_working_status;
      formData.applicantWorkingPremises = report.applicant_working_premises;

      // Office Information
      formData.officeStatus = report.office_status;
      formData.officeExistence = report.office_existence;
      formData.officeType = report.office_type;
      formData.companyNatureOfBusiness = report.company_nature_of_business;
      formData.businessPeriod = report.business_period;
      formData.establishmentPeriod = report.establishment_period;
      formData.workingPeriod = report.working_period;
      formData.workingStatus = report.working_status;
      formData.approxArea = report.approx_area;
      formData.sittingLocation = report.sitting_location;
      formData.companyNameplateStatus = report.company_nameplate_status;
      formData.nameOnCompanyBoard = report.name_on_company_board;

      // Staff Information
      formData.staffStrength = report.staff_strength;
      formData.staffSeen = report.staff_seen;

      // Document Verification
      formData.documentShownStatus = report.document_shown_status;
      formData.documentType = report.document_type;

      // Third Party Confirmation
      formData.tpcMetPerson1 = report.tpc_met_person1;
      formData.tpcName1 = report.tpc_name1;
      formData.tpcConfirmation1 = report.tpc_confirmation1;
      formData.tpcMetPerson2 = report.tpc_met_person2;
      formData.tpcName2 = report.tpc_name2;
      formData.tpcConfirmation2 = report.tpc_confirmation2;
      formData.nameOfMetPerson = report.name_of_met_person;
      formData.metPersonType = report.met_person_type;
      formData.metPersonConfirmation = report.met_person_confirmation;

      // Shifting & Contact Details
      formData.shiftedPeriod = report.shifted_period;
      formData.oldOfficeShiftedPeriod = report.old_office_shifted_period;
      formData.currentCompanyName = report.current_company_name;
      formData.currentCompanyPeriod = report.current_company_period;
      formData.premisesStatus = report.premises_status;
      formData.contactPerson = report.contact_person;
      formData.callRemark = report.call_remark;

      // Area Assessment & Final Status
      formData.politicalConnection = report.political_connection;
      formData.dominatedArea = report.dominated_area;
      formData.feedbackFromNeighbour = report.feedback_from_neighbour;
      formData.otherObservation = report.other_observation;
      formData.otherExtraRemark = report.other_extra_remark;
      formData.finalStatus = report.final_status;
      formData.holdReason = report.hold_reason;
      formData.recommendationStatus = report.recommendation_status;
      formData.remarks = report.remarks;
      formData.entryRestrictionReason = report.entry_restriction_reason;
      formData.securityPersonName = report.security_person_name;
      formData.accessDenied = report.access_denied;
      formData.nameOfMetPerson = report.name_of_met_person;
      formData.metPersonType = report.met_person_type;
      formData.applicantStayingStatus = report.applicant_staying_status;
      formData.contactPerson = report.contact_person;
      formData.alternateContact = report.alternate_contact;
      formData.holdReason = report.hold_reason;
    }

    return formData;
  }

  // Fallback method for basic form sections from report
  private static createBasicFormSectionsFromReport(report: any, verificationType: string): FormSection[] {
    return [
      {
        id: 'basic_information',
        title: 'Basic Information',
        description: 'Customer and verification details',
        order: 1,
        fields: [
          {
            id: 'customer_name',
            name: 'customerName',
            label: 'Customer Name',
            type: 'text',
            value: report.customer_name,
            displayValue: report.customer_name || 'Not provided',
            isRequired: true,
            validation: { isValid: true, errors: [] }
          },
          {
            id: 'verification_outcome',
            name: 'verificationOutcome',
            label: 'Verification Outcome',
            type: 'select',
            value: report.verification_outcome,
            displayValue: report.verification_outcome || 'Not provided',
            isRequired: true,
            validation: { isValid: true, errors: [] }
          },
          {
            id: 'met_person_name',
            name: 'metPersonName',
            label: 'Met Person Name',
            type: 'text',
            value: report.met_person_name,
            displayValue: report.met_person_name || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] }
          },
          {
            id: 'call_remark',
            name: 'callRemark',
            label: 'Call Remark',
            type: 'select',
            value: report.call_remark,
            displayValue: report.call_remark || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] }
          }
        ],
        isRequired: true,
        defaultExpanded: true
      },
      {
        id: 'location_details',
        title: 'Location Details',
        description: 'Address and location information',
        order: 2,
        fields: [
          {
            id: 'locality',
            name: 'locality',
            label: 'Locality Type',
            type: 'select',
            value: report.locality,
            displayValue: report.locality || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] }
          },
          {
            id: 'landmark1',
            name: 'landmark1',
            label: 'Landmark 1',
            type: 'text',
            value: report.landmark1,
            displayValue: report.landmark1 || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] }
          },
          {
            id: 'landmark2',
            name: 'landmark2',
            label: 'Landmark 2',
            type: 'text',
            value: report.landmark2,
            displayValue: report.landmark2 || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] }
          },
          {
            id: 'landmark3',
            name: 'landmark3',
            label: 'Landmark 3',
            type: 'text',
            value: report.landmark3,
            displayValue: report.landmark3 || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] }
          },
          {
            id: 'landmark4',
            name: 'landmark4',
            label: 'Landmark 4',
            type: 'text',
            value: report.landmark4,
            displayValue: report.landmark4 || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] }
          }
        ],
        isRequired: false,
        defaultExpanded: true
      },
      {
        id: 'area_assessment',
        title: 'Area Assessment',
        description: 'Area and final assessment details',
        order: 3,
        fields: [
          {
            id: 'dominated_area',
            name: 'dominatedArea',
            label: 'Dominated Area',
            type: 'select',
            value: report.dominated_area,
            displayValue: report.dominated_area || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] }
          },
          {
            id: 'other_observation',
            name: 'otherObservation',
            label: 'Other Observations',
            type: 'textarea',
            value: report.other_observation,
            displayValue: report.other_observation || 'Not provided',
            isRequired: false,
            validation: { isValid: true, errors: [] }
          },
          {
            id: 'final_status',
            name: 'finalStatus',
            label: 'Final Status',
            type: 'select',
            value: report.final_status,
            displayValue: report.final_status || 'Not provided',
            isRequired: true,
            validation: { isValid: true, errors: [] }
          }
        ],
        isRequired: false,
        defaultExpanded: true
      }
    ];
  }

  // REMOVED: Generic verification function - using specific implementations instead
  private static async submitGenericVerification_DISABLED(
    req: Request,
    res: Response,
    verificationType: string,
    reportTableName?: string
  ) {
    try {
      const { caseId } = req.params;
      const { formData, attachmentIds, geoLocation, photos, metadata }: MobileFormSubmissionRequest = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      // Verify case access
      const where: any = { id: caseId };
      if (userRole === 'FIELD_AGENT') {
        where.assignedTo = userId;
      }

      const vals: any[] = [caseId];
      let caseSql = `SELECT id FROM cases WHERE id = $1`;
      if (userRole === 'FIELD_AGENT') { caseSql += ` AND "assignedTo" = $2`; vals.push(userId); }
      const caseRes = await query(caseSql, vals);
      const existingCase = caseRes.rows[0];

      if (!existingCase) {
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      if (!photos || photos.length < 5) {
        return res.status(400).json({
          success: false,
          message: `Minimum 5 geo-tagged photos required for ${verificationType.toLowerCase()} verification`,
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photos?.length || 0,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location
      const photosWithoutGeo = photos.filter(photo =>
        !photo.geoLocation ||
        !photo.geoLocation.latitude ||
        !photo.geoLocation.longitude
      );

      if (photosWithoutGeo.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'All photos must have geo-location data',
          error: {
            code: 'MISSING_GEO_LOCATION',
            details: {
              photosWithoutGeo: photosWithoutGeo.length,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Skip attachment validation for now - attachments are handled separately

      // Get user details for comprehensive data
      const userRes = await query(`SELECT name, username FROM users WHERE id = $1`, [userId]);
      const user = userRes.rows[0];

      // ENHANCED DATA PROCESSING PIPELINE (Temporarily disabled for app startup)
      // TODO: Re-enable after fixing TypeScript issues
      console.log(`🔄 Using basic data processing for case ${caseId}, verification type: ${verificationType}`);

      // Prepare comprehensive verification data
      const verificationData = {
        id: `form_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        caseId,
        formType: verificationType,
        verificationType: formData.outcome || 'VERIFIED',
        outcome: formData.finalStatus || formData.outcome || 'POSITIVE',
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        submittedByName: user?.name || 'Unknown',

        // Organize form data into sections (this will be enhanced based on form type)
        sections: this.organizeFormDataIntoSections(formData, verificationType),

        // Enhanced attachments and photos
        attachments: attachmentIds.map(id => ({
          id,
          category: 'DOCUMENT' as const,
        })),
        photos: photos.map(photo => ({
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          attachmentId: photo.attachmentId,
          type: photo.type,
          geoLocation: {
            ...photo.geoLocation,
            address: photo.geoLocation.address || 'Address not available',
          },
          metadata: photo.metadata || {
            fileSize: 0,
            dimensions: { width: 0, height: 0 },
            capturedAt: new Date().toISOString(),
          },
        })),

        // Enhanced geo-location
        geoLocation: {
          ...geoLocation,
          address: geoLocation.address || 'Address not available',
        },

        // Enhanced metadata
        metadata: metadata || {
          submissionTimestamp: new Date().toISOString(),
          deviceInfo: {
            platform: 'UNKNOWN' as const,
            model: 'Unknown',
            osVersion: 'Unknown',
            appVersion: 'Unknown',
          },
          networkInfo: {
            type: 'UNKNOWN' as const,
          },
          formVersion: '1.0',
          submissionAttempts: 1,
          isOfflineSubmission: false,
        },

        // Validation status
        validationStatus: 'VALID',
        validationErrors: [],

        // Legacy verification object for backward compatibility
        verification: {
          ...formData,
          photoCount: photos.length,
          geoTaggedPhotos: photos.length,
          submissionLocation: geoLocation,
        },
      };

      // Update case with verification data
      await query(`UPDATE cases SET status = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP, "verificationData" = $1, "verificationType" = $2, "verificationOutcome" = $3, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $4`, [JSON.stringify(verificationData), verificationType, formData.outcome || 'VERIFIED', caseId]);
      const caseUpd = await query(`SELECT id, status, "completedAt" FROM cases WHERE id = $1`, [caseId]);
      const updatedCase = caseUpd.rows[0];

      // Auto-calculate commission for completed case
      try {
        const { autoCalculateCommissionForCase } = await import('../controllers/commissionManagementController');
        await autoCalculateCommissionForCase(caseId);
      } catch (error) {
        console.error('Error auto-calculating commission for residence form:', error);
        // Don't fail the form submission if commission calculation fails
      }

      // Update attachment geo-locations
      for (const photo of photos) {
        await query(`UPDATE attachments SET "geoLocation" = $1 WHERE id = $2`, [JSON.stringify(photo.geoLocation), photo.attachmentId]);
      }

      await createAuditLog({
        action: `${verificationType}_VERIFICATION_SUBMITTED`,
        entityType: 'CASE',
        entityId: caseId,
        userId,
        details: {
          formType: verificationType,
          photoCount: photos.length,
          attachmentCount: attachmentIds.length,
          outcome: formData.outcome,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.json({
        success: true,
        message: `${verificationType.charAt(0).toUpperCase() + verificationType.slice(1).toLowerCase()} verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          verificationId: verificationData,
        },
      });
    } catch (error) {
      console.error(`Submit ${verificationType.toLowerCase()} verification error:`, error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Get form submissions for a case
  static async getCaseFormSubmissions(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      console.log('Getting form submissions for case:', caseId, 'User:', userId, 'Role:', userRole);

      // Validate caseId parameter
      if (!caseId || caseId.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Case ID is required',
          error: {
            code: 'INVALID_CASE_ID',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Verify case access - handle both UUID and business caseId
      const vals: any[] = [];
      let caseSql = `SELECT id, "customerName", "verificationData", "verificationType", "verificationOutcome", status FROM cases WHERE `;

      // Check if caseId is a number (business caseId) or UUID
      const isNumeric = /^\d+$/.test(caseId);
      if (isNumeric) {
        caseSql += `"caseId" = $1`;
        vals.push(parseInt(caseId));
      } else {
        caseSql += `id = $1`;
        vals.push(caseId);
      }

      if (userRole === 'FIELD_AGENT') {
        caseSql += ` AND "assignedTo" = $2`;
        vals.push(userId);
      }

      console.log('Executing query:', caseSql, 'with values:', vals);
      const caseRes = await query(caseSql, vals);
      const caseData = caseRes.rows[0];
      console.log('Case data found:', caseData);

      if (!caseData) {
        console.log('Case not found for ID:', caseId, 'User role:', userRole);
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Get form submissions from verification reports and images
      const formSubmissions: FormSubmissionData[] = [];

      // Determine verification type and get appropriate reports
      const verificationType = caseData.verificationType || 'RESIDENCE';
      console.log('Processing verification type:', verificationType);

      // Get verification reports based on type
      let reportData = null;
      let reportTableName = '';

      if (verificationType === 'RESIDENCE') {
        reportTableName = 'residenceVerificationReports';
        const residenceReportSql = `SELECT * FROM "residenceVerificationReports" WHERE case_id = $1`;
        const residenceRes = await query(residenceReportSql, [caseData.id]);
        reportData = residenceRes.rows[0];
      } else if (verificationType === 'OFFICE') {
        reportTableName = 'officeVerificationReports';
        const officeReportSql = `SELECT * FROM "officeVerificationReports" WHERE case_id = $1`;
        const officeRes = await query(officeReportSql, [caseData.id]);
        reportData = officeRes.rows[0];
      } else if (verificationType === 'BUSINESS') {
        reportTableName = 'businessVerificationReports';
        const businessReportSql = `SELECT * FROM "businessVerificationReports" WHERE case_id = $1`;
        const businessRes = await query(businessReportSql, [caseData.id]);
        reportData = businessRes.rows[0];
      } else if (verificationType === 'PROPERTY_APF') {
        reportTableName = 'propertyApfVerificationReports';
        const propertyApfReportSql = `SELECT * FROM "propertyApfVerificationReports" WHERE case_id = $1`;
        const propertyApfRes = await query(propertyApfReportSql, [caseData.id]);
        reportData = propertyApfRes.rows[0];
      } else if (verificationType === 'PROPERTY_INDIVIDUAL') {
        reportTableName = 'propertyIndividualVerificationReports';
        const propertyIndividualReportSql = `SELECT * FROM "propertyIndividualVerificationReports" WHERE case_id = $1`;
        const propertyIndividualRes = await query(propertyIndividualReportSql, [caseData.id]);
        reportData = propertyIndividualRes.rows[0];
      } else if (verificationType === 'DSA/DST & Connector' || verificationType === 'CONNECTOR' || verificationType === 'DSA_CONNECTOR') {
        reportTableName = 'dsaConnectorVerificationReports';
        const dsaConnectorReportSql = `SELECT * FROM "dsaConnectorVerificationReports" WHERE case_id = $1`;
        const dsaConnectorRes = await query(dsaConnectorReportSql, [caseData.id]);
        reportData = dsaConnectorRes.rows[0];
      } else if (verificationType === 'NOC') {
        reportTableName = 'nocVerificationReports';
        const nocReportSql = `SELECT * FROM "nocVerificationReports" WHERE case_id = $1`;
        const nocRes = await query(nocReportSql, [caseData.id]);
        reportData = nocRes.rows[0];
      } else if (verificationType === 'BUILDER') {
        reportTableName = 'builderVerificationReports';
        const builderReportSql = `SELECT * FROM "builderVerificationReports" WHERE case_id = $1`;
        const builderRes = await query(builderReportSql, [caseData.id]);
        reportData = builderRes.rows[0];
      } else if (verificationType === 'Residence-cum-office' || verificationType === 'RESIDENCE_CUM_OFFICE') {
        reportTableName = 'residenceCumOfficeVerificationReports';
        const residenceCumOfficeReportSql = `SELECT * FROM "residenceCumOfficeVerificationReports" WHERE case_id = $1`;
        const residenceCumOfficeRes = await query(residenceCumOfficeReportSql, [caseData.id]);
        reportData = residenceCumOfficeRes.rows[0];
      } else {
        // Fallback to residence for unknown types
        reportTableName = 'residenceVerificationReports';
        const residenceReportSql = `SELECT * FROM "residenceVerificationReports" WHERE case_id = $1`;
        const residenceRes = await query(residenceReportSql, [caseData.id]);
        reportData = residenceRes.rows[0];
      }

      console.log(`Found report data in ${reportTableName}:`, !!reportData);

      if (reportData) {
        const report = reportData;

        // Get verification images
        const imagesSql = `
          SELECT * FROM verification_attachments
          WHERE case_id = $1
          ORDER BY "createdAt"
        `;
        const imagesRes = await query(imagesSql, [caseData.id]);

        // Get user info
        const userSql = `SELECT name, username FROM users WHERE id = $1`;
        const userRes = await query(userSql, [report.verified_by]);
        const userName = userRes.rows[0]?.name || userRes.rows[0]?.username || 'Unknown User';

        // Get the actual submission ID from verification images
        const actualSubmissionId = imagesRes.rows.length > 0 ? imagesRes.rows[0].submissionId : `${verificationType.toLowerCase()}_${Date.now()}`;

        // Create comprehensive form submission
        const submission: FormSubmissionData = {
          id: actualSubmissionId,
          caseId,
          formType: report.form_type || 'POSITIVE', // Use the actual form type from database
          verificationType: verificationType,
          outcome: report.verification_outcome || 'Unknown',
          status: 'SUBMITTED',
          submittedAt: report.verification_date ? `${report.verification_date}T00:00:00.000Z` : new Date().toISOString(),
          submittedBy: report.verified_by,
          submittedByName: userName,

          // Create comprehensive form sections using all available data
          sections: MobileFormController.createComprehensiveFormSectionsFromReport(report, verificationType, report.form_type || 'POSITIVE'),

          // Convert verification images to photos format
          photos: imagesRes.rows.map((img, index) => ({
            id: img.id,
            attachmentId: img.id,
            type: (img.photoType === 'selfie' ? 'selfie' : 'verification') as 'verification' | 'selfie',
            url: `/api/verification-attachments/${img.id}/download`,
            thumbnailUrl: `/api/verification-attachments/${img.id}/thumbnail`,
            filename: img.filename,
            size: img.fileSize,
            capturedAt: img.createdAt,
            geoLocation: {
              latitude: 0, // TODO: Add geo data if available
              longitude: 0,
              accuracy: 0,
              timestamp: img.createdAt,
              address: 'Location captured during verification'
            },
            metadata: {
              fileSize: img.fileSize,
              mimeType: 'image/jpeg',
              dimensions: { width: 0, height: 0 }, // TODO: Add if available
              capturedAt: img.createdAt
            }
          })),

          attachments: [], // No separate attachments for this form type

          geoLocation: {
            latitude: 0, // TODO: Add actual geo data
            longitude: 0,
            accuracy: 0,
            timestamp: report.verification_date ? `${report.verification_date}T00:00:00.000Z` : new Date().toISOString(),
            address: 'Verification location'
          },

          metadata: {
            submissionTimestamp: report.verification_date ? `${report.verification_date}T00:00:00.000Z` : new Date().toISOString(),
            deviceInfo: {
              platform: 'ANDROID' as const, // Default for mobile submissions
              model: 'Mobile Device',
              osVersion: 'Unknown',
              appVersion: '4.0.0',
            },
            networkInfo: {
              type: 'WIFI' as const,
            },
            formVersion: '1.0',
            submissionAttempts: 1,
            isOfflineSubmission: false
          },

          validationStatus: 'VALID',
          validationErrors: [],
        };

        formSubmissions.push(submission);
      }

      res.json({
        success: true,
        message: 'Form submissions retrieved successfully',
        data: {
          caseId,
          submissions: formSubmissions,
          totalCount: formSubmissions.length,
        },
      });
    } catch (error) {
      console.error('Get case form submissions error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        caseId: req.params.caseId,
        userId: (req as any).user?.id
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'FORM_RETRIEVAL_FAILED',
          timestamp: new Date().toISOString(),
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
      });
    }
  }

  // Helper method to determine form type and verification outcome from form data
  private static determineResidenceFormTypeAndOutcome(formData: any): { formType: string; verificationOutcome: string } {
    return detectResidenceFormType(formData);
  }

  // Submit residence verification form
  static async submitResidenceVerification(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const { formData, attachmentIds, geoLocation, photos, images }: MobileFormSubmissionRequest = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      console.log(`📱 Residence verification submission for case: ${caseId}`);
      console.log(`   - User: ${userId} (${userRole})`);
      console.log(`   - Images: ${images?.length || 0}`);
      console.log(`   - Form data keys: ${Object.keys(formData || {}).join(', ')}`);

      // Check if caseId is a UUID (mobile sends UUID) or case number (web sends case number)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId);

      // Verify case access
      const vals: any[] = [caseId];
      let caseSql: string;

      if (isUUID) {
        // Mobile app sends UUID
        caseSql = `SELECT id, "caseId", status, "assignedTo" FROM cases WHERE id = $1`;
      } else {
        // Web app sends case number
        caseSql = `SELECT id, "caseId", status, "assignedTo" FROM cases WHERE "caseId" = $1`;
      }

      if (userRole === 'FIELD_AGENT') {
        caseSql += ` AND "assignedTo" = $2`;
        vals.push(userId);
      }

      const caseRes = await query(caseSql, vals);
      const existingCase = caseRes.rows[0];

      if (!existingCase) {
        console.log(`❌ Case not found: ${caseId} (isUUID: ${isUUID})`);
        return res.status(404).json({
          success: false,
          message: 'Case not found or access denied',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
            caseId,
            isUUID,
          },
        });
      }

      const actualCaseId = existingCase.id; // Use the actual UUID from the database
      console.log(`✅ Case found: ${actualCaseId} (Case #${existingCase.caseId})`);

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = MobileFormController.determineResidenceFormTypeAndOutcome(formData);

      console.log(`🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`);

      // Use comprehensive validation and preparation for residence form data
      const { validationResult, preparedData } = validateAndPrepareResidenceForm(formData, formType);

      // Log comprehensive validation results
      console.log(`📊 Comprehensive validation for ${formType} residence verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage
      });

      // Generate and log field coverage report
      const coverageReport = generateFieldCoverageReport(formData, preparedData, formType);
      console.log(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        console.warn(`⚠️ Missing required fields for ${formType} form:`, validationResult.missingFields);
      }
      if (validationResult.warnings.length > 0) {
        console.warn(`⚠️ Validation warnings for ${formType} residence form:`, validationResult.warnings);
      }

      console.log(`📊 Mapped ${Object.keys(mappedFormData).length} form fields to database columns`);

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = images?.length || photos?.length || 0;
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for residence verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(photo =>
          !photo.geoLocation ||
          !photo.geoLocation.latitude ||
          !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `residence_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        actualCaseId,
        'RESIDENCE',
        submissionId,
        userId
      );

      console.log(`✅ Processed ${uploadedImages.length} verification images for residence verification`);

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'RESIDENCE',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Update case with verification data using detected verification outcome
      await query(`UPDATE cases SET status = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP, "verificationData" = $1, "verificationType" = 'RESIDENCE', "verificationOutcome" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`, [JSON.stringify(verificationData), verificationOutcome, actualCaseId]);
      const caseUpd = await query(`SELECT id, "caseId", status, "completedAt", "customerName", "backendContactNumber", address FROM cases WHERE id = $1`, [actualCaseId]);
      const updatedCase = caseUpd.rows[0];

      // Create comprehensive residence verification report using all available fields
      const dbInsertData = {
        // Core case information
        case_id: actualCaseId,
        caseId: parseInt(updatedCase.caseId) || null,
        form_type: formType,
        verification_outcome: verificationOutcome,
        customer_name: updatedCase.customerName || 'Unknown',
        customer_phone: updatedCase.backendContactNumber || null,
        customer_email: null, // Not available from case data
        full_address: updatedCase.address || 'Address not provided',

        // Verification metadata
        verification_date: new Date().toISOString().split('T')[0],
        verification_time: new Date().toTimeString().split(' ')[0],
        verified_by: userId,
        total_images: uploadedImages.length || 0,
        total_selfies: uploadedImages.filter(img => img.photoType === 'selfie').length || 0,
        remarks: formData.remarks || `${formType} residence verification completed`,

        // Merge all mapped form data (already includes defaults for missing fields)
        ...mappedFormData
      };

      // Log comprehensive database insert data for debugging
      const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
      const populatedFields = Object.entries(dbInsertData).filter(([_, value]) =>
        value !== null && value !== undefined && value !== ''
      );

      console.log(`📝 Final database insert data for ${formType} residence verification:`, {
        totalFields: Object.keys(dbInsertData).length,
        populatedFields: populatedFields.length,
        fieldsWithNullValues: nullFields.length,
        fieldCoveragePercentage: Math.round((populatedFields.length / Object.keys(dbInsertData).length) * 100),
        nullFieldNames: nullFields.map(([key]) => key).slice(0, 10), // Show first 10 null fields
        samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)) // Show first 10 populated fields
      });

      // Build dynamic INSERT query based on available data
      const columns = Object.keys(dbInsertData).filter(key => dbInsertData[key] !== undefined);
      const values = columns.map(key => dbInsertData[key]);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const columnNames = columns.map(col => `"${col}"`).join(', ');

      const insertQuery = `
        INSERT INTO "residenceVerificationReports" (${columnNames})
        VALUES (${placeholders})
      `;

      console.log(`📝 Inserting residence verification with ${columns.length} fields:`, columns);

      await query(insertQuery, values);

      // Remove auto-save data (autoSaves table doesn't have form_type column)
      await query(`DELETE FROM "autoSaves" WHERE case_id = $1::uuid`, [actualCaseId]);

      await createAuditLog({
        action: 'RESIDENCE_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: actualCaseId,
        userId,
        details: {
          formType: 'RESIDENCE',
          submissionId,
          verificationImageCount: uploadedImages.length,
          geoTaggedImageCount: uploadedImages.filter(img => img.geoLocation).length,
          outcome: formData.outcome,
          hasGeoLocation: !!geoLocation,
          caseNumber: existingCase.caseId,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      console.log(`✅ Residence verification completed successfully:`, {
        caseId: actualCaseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        actualCaseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} residence verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      console.error('Submit residence verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit office verification form
  static async submitOfficeVerification(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const { formData, attachmentIds, geoLocation, photos, images }: MobileFormSubmissionRequest = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      console.log(`📱 Office verification submission for case: ${caseId}`);
      console.log(`   - User: ${userId} (${userRole})`);
      console.log(`   - Images: ${images?.length || 0}`);
      console.log(`   - Form data keys: ${Object.keys(formData || {}).join(', ')}`);
      console.log(`   - Form data outcome: ${formData?.outcome || formData?.finalStatus || 'Not specified'}`);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!caseId) {
        return res.status(400).json({
          success: false,
          message: 'Case ID is required',
          error: {
            code: 'CASE_ID_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!formData) {
        return res.status(400).json({
          success: false,
          message: 'Form data is required',
          error: {
            code: 'FORM_DATA_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate case exists and user has access
      const caseQuery = await query(`SELECT id, "caseId", "customerName", "assignedTo", address, "backendContactNumber" as "systemContact" FROM cases WHERE id = $1`, [caseId]);
      if (caseQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const existingCase = caseQuery.rows[0];
      const actualCaseId = existingCase.id;

      // Validate user assignment (allow admin users to submit for any case)
      if (userRole !== 'ADMIN' && existingCase.assignedTo !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this case',
          error: {
            code: 'CASE_NOT_ASSIGNED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.log(`✅ Case found: ${actualCaseId} (Case #${existingCase.caseId})`);

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = detectOfficeFormType(formData);

      console.log(`🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`);

      // Use comprehensive validation and preparation for office form data
      const { validationResult, preparedData } = validateAndPrepareOfficeForm(formData, formType);

      // Log comprehensive validation results
      console.log(`📊 Comprehensive validation for ${formType} office verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage
      });

      // Generate and log field coverage report
      const coverageReport = generateOfficeFieldCoverageReport(formData, preparedData, formType);
      console.log(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        console.warn(`⚠️ Missing required fields for ${formType} office form:`, validationResult.missingFields);
      }
      if (validationResult.warnings.length > 0) {
        console.warn(`⚠️ Validation warnings for ${formType} office form:`, validationResult.warnings);
      }

      // Validate required fields for the detected form type
      const validation = validateOfficeRequiredFields(formData, formType);
      if (!validation.isValid) {
        console.warn(`⚠️ Missing required fields for ${formType} office form:`, validation.missingFields);
      }
      if (validation.warnings.length > 0) {
        console.warn(`⚠️ Office form validation warnings:`, validation.warnings);
      }

      console.log(`📊 Mapped ${Object.keys(mappedFormData).length} office form fields to database columns`);

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = images?.length || photos?.length || 0;
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for office verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(photo =>
          !photo.geoLocation ||
          !photo.geoLocation.latitude ||
          !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `office_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        actualCaseId,
        'OFFICE',
        submissionId,
        userId
      );

      console.log(`✅ Processed ${uploadedImages.length} verification images for office verification`);

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'OFFICE',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Update case with verification data using detected verification outcome
      await query(`UPDATE cases SET status = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP, "verificationData" = $1, "verificationType" = 'OFFICE', "verificationOutcome" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`, [JSON.stringify(verificationData), verificationOutcome, actualCaseId]);
      const caseUpd = await query(`SELECT id, "caseId", status, "completedAt", "customerName", "backendContactNumber", address FROM cases WHERE id = $1`, [actualCaseId]);
      const updatedCase = caseUpd.rows[0];

      // Auto-calculate commission for completed case
      try {
        const { autoCalculateCommissionForCase } = await import('../controllers/commissionManagementController');
        await autoCalculateCommissionForCase(actualCaseId);
      } catch (error) {
        console.error('Error auto-calculating commission for office form:', error);
        // Don't fail the form submission if commission calculation fails
      }

      // Create comprehensive office verification report using all available fields
      const dbInsertData = {
        // Core case information
        case_id: actualCaseId,
        caseId: parseInt(updatedCase.caseId) || null,
        form_type: formType,
        verification_outcome: verificationOutcome,
        customer_name: updatedCase.customerName || 'Unknown',
        customer_phone: updatedCase.backendContactNumber || null,
        customer_email: null, // Not available from case data
        full_address: updatedCase.address || 'Address not provided',

        // Verification metadata
        verification_date: new Date().toISOString().split('T')[0],
        verification_time: new Date().toTimeString().split(' ')[0],
        verified_by: userId,
        total_images: uploadedImages.length || 0,
        total_selfies: uploadedImages.filter(img => img.photoType === 'selfie').length || 0,
        remarks: formData.remarks || `${formType} office verification completed`,

        // Merge all mapped form data
        ...mappedFormData
      };

      // Build dynamic INSERT query based on available data
      const columns = Object.keys(dbInsertData).filter(key => dbInsertData[key] !== undefined);
      const values = columns.map(key => dbInsertData[key]);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const columnNames = columns.map(col => `"${col}"`).join(', ');

      const insertQuery = `
        INSERT INTO "officeVerificationReports" (${columnNames})
        VALUES (${placeholders})
      `;

      // Log comprehensive database insert data for debugging
      const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
      const populatedFields = Object.entries(dbInsertData).filter(([_, value]) =>
        value !== null && value !== undefined && value !== ''
      );

      console.log(`📝 Final database insert data for ${formType} office verification:`, {
        totalFields: Object.keys(dbInsertData).length,
        populatedFields: populatedFields.length,
        fieldsWithNullValues: nullFields.length,
        fieldCoveragePercentage: Math.round((populatedFields.length / Object.keys(dbInsertData).length) * 100),
        nullFieldNames: nullFields.map(([key]) => key).slice(0, 10), // Show first 10 null fields
        samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)) // Show first 10 populated fields
      });

      console.log(`📝 Inserting office verification with ${columns.length} fields:`, columns);

      await query(insertQuery, values);

      // Remove auto-save data
      await query(`DELETE FROM "autoSaves" WHERE case_id = $1::uuid`, [actualCaseId]);

      await createAuditLog({
        action: 'OFFICE_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: actualCaseId,
        userId,
        details: {
          formType,
          verificationOutcome,
          imageCount: uploadedImages.length,
          submissionId,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      console.log(`✅ Office verification completed successfully:`, {
        caseId: actualCaseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        actualCaseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} office verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      console.error('Submit office verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit business verification form
  static async submitBusinessVerification(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const { formData, attachmentIds, geoLocation, photos, images }: MobileFormSubmissionRequest = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      console.log(`📱 Business verification submission for case: ${caseId}`);
      console.log(`   - User: ${userId} (${userRole})`);
      console.log(`   - Images: ${images?.length || 0}`);
      console.log(`   - Form data keys: ${Object.keys(formData || {}).join(', ')}`);
      console.log(`   - Form data outcome: ${formData?.outcome || formData?.finalStatus || 'Not specified'}`);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!caseId) {
        return res.status(400).json({
          success: false,
          message: 'Case ID is required',
          error: {
            code: 'CASE_ID_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!formData) {
        return res.status(400).json({
          success: false,
          message: 'Form data is required',
          error: {
            code: 'FORM_DATA_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate case exists and user has access
      const caseQuery = await query(`SELECT id, "caseId", "customerName", "assignedTo", address, "backendContactNumber" as "systemContact" FROM cases WHERE id = $1`, [caseId]);
      if (caseQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const existingCase = caseQuery.rows[0];
      const actualCaseId = existingCase.id;

      // Validate user assignment (allow admin users to submit for any case)
      if (userRole !== 'ADMIN' && existingCase.assignedTo !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this case',
          error: {
            code: 'CASE_NOT_ASSIGNED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.log(`✅ Case found: ${actualCaseId} (Case #${existingCase.caseId})`);

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = detectBusinessFormType(formData);

      console.log(`🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`);

      // Use comprehensive validation and preparation for business form data
      const { validationResult, preparedData } = validateAndPrepareBusinessForm(formData, formType);

      // Log comprehensive validation results
      console.log(`📊 Comprehensive validation for ${formType} business verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage
      });

      // Generate and log field coverage report
      const coverageReport = generateBusinessFieldCoverageReport(formData, preparedData, formType);
      console.log(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        console.warn(`⚠️ Missing required fields for ${formType} business form:`, validationResult.missingFields);
      }
      if (validationResult.warnings.length > 0) {
        console.warn(`⚠️ Validation warnings for ${formType} business form:`, validationResult.warnings);
      }

      // Validate required fields for the detected form type
      const validation = validateBusinessRequiredFields(formData, formType);
      if (!validation.isValid) {
        console.warn(`⚠️ Missing required fields for ${formType} business form:`, validation.missingFields);
      }
      if (validation.warnings.length > 0) {
        console.warn(`⚠️ Business form validation warnings:`, validation.warnings);
      }

      console.log(`📊 Mapped ${Object.keys(mappedFormData).length} business form fields to database columns`);

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = images?.length || photos?.length || 0;
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for business verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(photo =>
          !photo.geoLocation ||
          !photo.geoLocation.latitude ||
          !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `business_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        actualCaseId,
        'BUSINESS',
        submissionId,
        userId
      );

      console.log(`✅ Processed ${uploadedImages.length} verification images for business verification`);

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'BUSINESS',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Update case with verification data using detected verification outcome
      await query(`UPDATE cases SET status = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP, "verificationData" = $1, "verificationType" = 'BUSINESS', "verificationOutcome" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`, [JSON.stringify(verificationData), verificationOutcome, actualCaseId]);
      const caseUpd = await query(`SELECT id, "caseId", status, "completedAt", "customerName", "backendContactNumber", address FROM cases WHERE id = $1`, [actualCaseId]);
      const updatedCase = caseUpd.rows[0];

      // Auto-calculate commission for completed case
      try {
        const { autoCalculateCommissionForCase } = await import('../controllers/commissionManagementController');
        await autoCalculateCommissionForCase(actualCaseId);
      } catch (error) {
        console.error('Error auto-calculating commission for business form:', error);
        // Don't fail the form submission if commission calculation fails
      }

      // Create comprehensive business verification report using all available fields
      const dbInsertData = {
        // Core case information
        case_id: actualCaseId,
        caseId: parseInt(updatedCase.caseId) || null,
        form_type: formType,
        verification_outcome: verificationOutcome,
        customer_name: updatedCase.customerName || 'Unknown',
        customer_phone: updatedCase.backendContactNumber || null,
        customer_email: null, // Not available from case data
        full_address: updatedCase.address || 'Address not provided',

        // Verification metadata
        verification_date: new Date().toISOString().split('T')[0],
        verification_time: new Date().toTimeString().split(' ')[0],
        verified_by: userId,
        total_images: uploadedImages.length || 0,
        total_selfies: uploadedImages.filter(img => img.photoType === 'selfie').length || 0,
        remarks: formData.remarks || `${formType} business verification completed`,

        // Merge all mapped form data
        ...mappedFormData
      };

      // Ensure final_status is always provided (required field)
      if (!dbInsertData['final_status']) {
        // Map outcome to final_status if not provided
        const outcomeToFinalStatusMap: Record<string, string> = {
          'VERIFIED': 'Positive',
          'NOT_VERIFIED': 'Negative',
          'FRAUD': 'Fraud',
          'REFER': 'Refer',
          'HOLD': 'Hold',
          'PARTIAL': 'Refer'
        };

        const outcome = formData.outcome || 'VERIFIED';
        dbInsertData['final_status'] = outcomeToFinalStatusMap[outcome] || 'Positive';
        console.log(`🔧 Auto-mapped outcome '${outcome}' to final_status '${dbInsertData['final_status']}'`);
      }

      // Build dynamic INSERT query based on available data
      // Filter out any camelCase fields that might have been accidentally included
      const columns = Object.keys(dbInsertData)
        .filter(key => dbInsertData[key] !== undefined)
        .filter(key => {
          // Only include snake_case database column names, exclude camelCase fields
          // Allow specific fields that don't have underscores but are valid DB columns
          return key.includes('_') || ['id', 'caseId', 'remarks', 'locality'].includes(key);
        });

      const values = columns.map(key => dbInsertData[key]);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const columnNames = columns.map(col => `"${col}"`).join(', ');

      console.log(`🔍 Filtered columns for SQL insert:`, columns);

      const insertQuery = `
        INSERT INTO "businessVerificationReports" (${columnNames})
        VALUES (${placeholders})
      `;

      // Log comprehensive database insert data for debugging
      const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
      const populatedFields = Object.entries(dbInsertData).filter(([_, value]) =>
        value !== null && value !== undefined && value !== ''
      );

      console.log(`📝 Final database insert data for ${formType} business verification:`, {
        totalFields: Object.keys(dbInsertData).length,
        populatedFields: populatedFields.length,
        fieldsWithNullValues: nullFields.length,
        fieldCoveragePercentage: Math.round((populatedFields.length / Object.keys(dbInsertData).length) * 100),
        nullFieldNames: nullFields.map(([key]) => key).slice(0, 10), // Show first 10 null fields
        samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)) // Show first 10 populated fields
      });

      console.log(`📝 Inserting business verification with ${columns.length} fields:`, columns);

      await query(insertQuery, values);

      // Remove auto-save data
      await query(`DELETE FROM "autoSaves" WHERE case_id = $1::uuid`, [actualCaseId]);

      await createAuditLog({
        action: 'BUSINESS_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: actualCaseId,
        userId,
        details: {
          formType,
          verificationOutcome,
          imageCount: uploadedImages.length,
          submissionId,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      console.log(`✅ Business verification completed successfully:`, {
        caseId: actualCaseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        actualCaseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} business verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      console.error('Submit business verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit builder verification form
  static async submitBuilderVerification(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const { formData, attachmentIds, geoLocation, photos, images }: MobileFormSubmissionRequest = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      console.log(`📱 Builder verification submission for case: ${caseId}`);
      console.log(`   - User: ${userId} (${userRole})`);
      console.log(`   - Images: ${images?.length || 0}`);
      console.log(`   - Form data keys: ${Object.keys(formData || {}).join(', ')}`);
      console.log(`   - Form data outcome: ${formData?.outcome || formData?.finalStatus || 'Not specified'}`);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!caseId) {
        return res.status(400).json({
          success: false,
          message: 'Case ID is required',
          error: {
            code: 'CASE_ID_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!formData) {
        return res.status(400).json({
          success: false,
          message: 'Form data is required',
          error: {
            code: 'FORM_DATA_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate case exists and user has access
      const caseQuery = await query(`SELECT id, "caseId", "customerName", "assignedTo", address, "backendContactNumber" as "systemContact" FROM cases WHERE id = $1`, [caseId]);
      if (caseQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const existingCase = caseQuery.rows[0];
      const actualCaseId = existingCase.id;

      // Validate user assignment (allow admin users to submit for any case)
      if (userRole !== 'ADMIN' && existingCase.assignedTo !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this case',
          error: {
            code: 'CASE_NOT_ASSIGNED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.log(`✅ Case found: ${actualCaseId} (Case #${existingCase.caseId})`);

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = detectBusinessFormType(formData); // Use business detection for builder (similar structure)

      console.log(`🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`);

      // Use comprehensive validation and preparation for builder form data
      const { validationResult, preparedData } = validateAndPrepareBuilderForm(formData, formType);

      // Log comprehensive validation results
      console.log(`📊 Comprehensive validation for ${formType} builder verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage
      });

      // Generate and log field coverage report
      const coverageReport = generateBuilderFieldCoverageReport(formData, preparedData, formType);
      console.log(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        console.warn(`⚠️ Missing required fields for ${formType} builder form:`, validationResult.missingFields);
      }
      if (validationResult.warnings.length > 0) {
        console.warn(`⚠️ Validation warnings for ${formType} builder form:`, validationResult.warnings);
      }

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = images?.length || photos?.length || 0;
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for builder verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(photo =>
          !photo.geoLocation ||
          !photo.geoLocation.latitude ||
          !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `builder_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        actualCaseId,
        'BUILDER',
        submissionId,
        userId
      );

      console.log(`✅ Processed ${uploadedImages.length} verification images for builder verification`);

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'BUILDER',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Update case with verification data using detected verification outcome
      await query(`UPDATE cases SET status = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP, "verificationData" = $1, "verificationType" = 'BUILDER', "verificationOutcome" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`, [JSON.stringify(verificationData), verificationOutcome, actualCaseId]);
      const caseUpd = await query(`SELECT id, "caseId", status, "completedAt", "customerName", "backendContactNumber", address FROM cases WHERE id = $1`, [actualCaseId]);
      const updatedCase = caseUpd.rows[0];

      // Auto-calculate commission for completed case
      try {
        const { autoCalculateCommissionForCase } = await import('../controllers/commissionManagementController');
        await autoCalculateCommissionForCase(actualCaseId);
      } catch (error) {
        console.error('Error auto-calculating commission for builder form:', error);
        // Don't fail the form submission if commission calculation fails
      }

      // Create comprehensive builder verification report using all available fields
      const dbInsertData = {
        // Core case information
        case_id: actualCaseId,
        caseId: parseInt(updatedCase.caseId) || null,
        form_type: formType,
        verification_outcome: verificationOutcome,
        customer_name: updatedCase.customerName || 'Unknown',
        customer_phone: updatedCase.backendContactNumber || null,
        customer_email: null, // Not available from case data
        full_address: updatedCase.address || 'Address not provided',

        // Verification metadata
        verification_date: new Date().toISOString().split('T')[0],
        verification_time: new Date().toTimeString().split(' ')[0],
        verified_by: userId,
        total_images: uploadedImages.length || 0,
        total_selfies: uploadedImages.filter(img => img.photoType === 'selfie').length || 0,
        remarks: formData.remarks || `${formType} builder verification completed`,

        // Merge all mapped form data
        ...mappedFormData
      };

      // Get valid database columns for builder verification
      const availableDbColumns = getBuilderAvailableDbColumns();

      // Add essential system fields that are always required
      const essentialFields = [
        'case_id', 'caseId', 'form_type', 'verification_outcome',
        'customer_name', 'customer_phone', 'customer_email', 'full_address',
        'verification_date', 'verification_time', 'verified_by',
        'total_images', 'total_selfies', 'remarks'
      ];
      const allValidColumns = [...new Set([...availableDbColumns, ...essentialFields])];

      // Filter columns to only include valid database columns
      const filteredColumns = Object.keys(dbInsertData)
        .filter(key => dbInsertData[key] !== undefined)
        .filter(key => allValidColumns.includes(key));

      console.log('🔍 Filtered columns for SQL insert:', filteredColumns);

      // Build dynamic INSERT query based on filtered columns
      const columns = filteredColumns;
      const values = columns.map(key => dbInsertData[key]);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const columnNames = columns.map(col => `"${col}"`).join(', ');

      const insertQuery = `
        INSERT INTO "builderVerificationReports" (${columnNames})
        VALUES (${placeholders})
      `;

      // Log comprehensive database insert data for debugging
      const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
      const populatedFields = Object.entries(dbInsertData).filter(([_, value]) =>
        value !== null && value !== undefined && value !== ''
      );

      console.log(`📝 Final database insert data for ${formType} builder verification:`, {
        totalFields: Object.keys(dbInsertData).length,
        populatedFields: populatedFields.length,
        fieldsWithNullValues: nullFields.length,
        fieldCoveragePercentage: Math.round((populatedFields.length / Object.keys(dbInsertData).length) * 100),
        nullFieldNames: nullFields.map(([key]) => key).slice(0, 10), // Show first 10 null fields
        samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)) // Show first 10 populated fields
      });

      console.log(`📝 Inserting builder verification with ${columns.length} fields:`, columns);

      await query(insertQuery, values);

      // Remove auto-save data
      await query(`DELETE FROM "autoSaves" WHERE case_id = $1::uuid`, [actualCaseId]);

      await createAuditLog({
        action: 'BUILDER_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: actualCaseId,
        userId,
        details: {
          formType,
          verificationOutcome,
          imageCount: uploadedImages.length,
          submissionId,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      console.log(`✅ Builder verification completed successfully:`, {
        caseId: actualCaseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        actualCaseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} builder verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      console.error('Submit builder verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit residence-cum-office verification form
  static async submitResidenceCumOfficeVerification(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const { formData, attachmentIds, geoLocation, photos, images }: MobileFormSubmissionRequest = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      console.log(`📱 Residence-cum-office verification submission for case: ${caseId}`);
      console.log(`   - User: ${userId} (${userRole})`);
      console.log(`   - Images: ${images?.length || 0}`);
      console.log(`   - Form data keys: ${Object.keys(formData || {}).join(', ')}`);
      console.log(`   - Form data outcome: ${formData?.outcome || formData?.finalStatus || 'Not specified'}`);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!caseId) {
        return res.status(400).json({
          success: false,
          message: 'Case ID is required',
          error: {
            code: 'CASE_ID_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!formData) {
        return res.status(400).json({
          success: false,
          message: 'Form data is required',
          error: {
            code: 'FORM_DATA_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate case exists and user has access
      const caseQuery = await query(`SELECT id, "caseId", "customerName", "assignedTo", address, "backendContactNumber" as "systemContact" FROM cases WHERE id = $1`, [caseId]);
      if (caseQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const existingCase = caseQuery.rows[0];
      const actualCaseId = existingCase.id;

      // Validate user assignment (allow admin users to submit for any case)
      if (userRole !== 'ADMIN' && existingCase.assignedTo !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this case',
          error: {
            code: 'CASE_NOT_ASSIGNED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.log(`✅ Case found: ${actualCaseId} (Case #${existingCase.caseId})`);

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = detectResidenceFormType(formData); // Use residence detection for hybrid form

      console.log(`🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`);

      // Use comprehensive validation and preparation for residence-cum-office form data
      const { validationResult, preparedData } = validateAndPrepareResidenceCumOfficeForm(formData, formType);

      // Log comprehensive validation results
      console.log(`📊 Comprehensive validation for ${formType} residence-cum-office verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage
      });

      // Generate and log field coverage report
      const coverageReport = generateResidenceCumOfficeFieldCoverageReport(formData, preparedData, formType);
      console.log(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        console.warn(`⚠️ Missing required fields for ${formType} residence-cum-office form:`, validationResult.missingFields);
      }
      if (validationResult.warnings.length > 0) {
        console.warn(`⚠️ Validation warnings for ${formType} residence-cum-office form:`, validationResult.warnings);
      }

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = images?.length || photos?.length || 0;
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for residence-cum-office verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(photo =>
          !photo.geoLocation ||
          !photo.geoLocation.latitude ||
          !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `residence_cum_office_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        actualCaseId,
        'RESIDENCE_CUM_OFFICE',
        submissionId,
        userId
      );

      console.log(`✅ Processed ${uploadedImages.length} verification images for residence-cum-office verification`);

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'RESIDENCE_CUM_OFFICE',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Update case with verification data using detected verification outcome
      await query(`UPDATE cases SET status = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP, "verificationData" = $1, "verificationType" = 'RESIDENCE_CUM_OFFICE', "verificationOutcome" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`, [JSON.stringify(verificationData), verificationOutcome, actualCaseId]);
      const caseUpd = await query(`SELECT id, "caseId", status, "completedAt", "customerName", "backendContactNumber", address FROM cases WHERE id = $1`, [actualCaseId]);
      const updatedCase = caseUpd.rows[0];

      // Create comprehensive residence-cum-office verification report using all available fields
      const dbInsertData = {
        // Core case information
        case_id: actualCaseId,
        caseId: parseInt(updatedCase.caseId) || null,
        form_type: formType,
        verification_outcome: verificationOutcome,
        customer_name: updatedCase.customerName || 'Unknown',
        customer_phone: updatedCase.backendContactNumber || null,
        customer_email: null, // Not available from case data
        full_address: updatedCase.address || 'Address not provided',

        // Verification metadata
        verification_date: new Date().toISOString().split('T')[0],
        verification_time: new Date().toTimeString().split(' ')[0],
        verified_by: userId,
        total_images: uploadedImages.length || 0,
        total_selfies: uploadedImages.filter(img => img.photoType === 'selfie').length || 0,
        remarks: formData.remarks || `${formType} residence-cum-office verification completed`,

        // Merge all mapped form data
        ...mappedFormData
      };

      // Build dynamic INSERT query based on available data
      const columns = Object.keys(dbInsertData).filter(key => dbInsertData[key] !== undefined);
      const values = columns.map(key => dbInsertData[key]);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const columnNames = columns.map(col => `"${col}"`).join(', ');

      const insertQuery = `
        INSERT INTO "residenceCumOfficeVerificationReports" (${columnNames})
        VALUES (${placeholders})
      `;

      // Log comprehensive database insert data for debugging
      const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
      const populatedFields = Object.entries(dbInsertData).filter(([_, value]) =>
        value !== null && value !== undefined && value !== ''
      );

      console.log(`📝 Final database insert data for ${formType} residence-cum-office verification:`, {
        totalFields: Object.keys(dbInsertData).length,
        populatedFields: populatedFields.length,
        fieldsWithNullValues: nullFields.length,
        fieldCoveragePercentage: Math.round((populatedFields.length / Object.keys(dbInsertData).length) * 100),
        nullFieldNames: nullFields.map(([key]) => key).slice(0, 10), // Show first 10 null fields
        samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)) // Show first 10 populated fields
      });

      console.log(`📝 Inserting residence-cum-office verification with ${columns.length} fields:`, columns);

      await query(insertQuery, values);

      // Remove auto-save data
      await query(`DELETE FROM "autoSaves" WHERE case_id = $1::uuid`, [actualCaseId]);

      await createAuditLog({
        action: 'RESIDENCE_CUM_OFFICE_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: actualCaseId,
        userId,
        details: {
          formType,
          verificationOutcome,
          imageCount: uploadedImages.length,
          submissionId,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      console.log(`✅ Residence-cum-office verification completed successfully:`, {
        caseId: actualCaseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        actualCaseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} residence-cum-office verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      console.error('Submit residence-cum-office verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit DSA/DST connector verification form
  static async submitDsaConnectorVerification(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const { formData, attachmentIds, geoLocation, photos, images }: MobileFormSubmissionRequest = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      console.log(`📱 DSA/DST Connector verification submission for case: ${caseId}`);
      console.log(`   - User: ${userId} (${userRole})`);
      console.log(`   - Images: ${images?.length || 0}`);
      console.log(`   - Form data keys: ${Object.keys(formData || {}).join(', ')}`);
      console.log(`   - Form data outcome: ${formData?.outcome || formData?.finalStatus || 'Not specified'}`);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!caseId) {
        return res.status(400).json({
          success: false,
          message: 'Case ID is required',
          error: {
            code: 'CASE_ID_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!formData) {
        return res.status(400).json({
          success: false,
          message: 'Form data is required',
          error: {
            code: 'FORM_DATA_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate case exists and user has access
      const caseQuery = await query(`SELECT id, "caseId", "customerName", "assignedTo", address, "backendContactNumber" as "systemContact" FROM cases WHERE id = $1`, [caseId]);
      if (caseQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const existingCase = caseQuery.rows[0];
      const actualCaseId = existingCase.id;

      // Validate user assignment (allow admin users to submit for any case)
      if (userRole !== 'ADMIN' && existingCase.assignedTo !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this case',
          error: {
            code: 'CASE_NOT_ASSIGNED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.log(`✅ Case found: ${actualCaseId} (Case #${existingCase.caseId})`);

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = detectBusinessFormType(formData); // Use business detection for DSA/DST Connector (similar structure)

      console.log(`🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`);

      // Use comprehensive validation and preparation for DSA Connector form data
      const { validationResult, preparedData } = validateAndPrepareDsaConnectorForm(formData, formType);

      // Log comprehensive validation results
      console.log(`📊 Comprehensive validation for ${formType} DSA Connector verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage
      });

      // Generate and log field coverage report
      const coverageReport = generateDsaConnectorFieldCoverageReport(formData, preparedData, formType);
      console.log(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        console.warn(`⚠️ Missing required fields for ${formType} DSA Connector form:`, validationResult.missingFields);
      }
      if (validationResult.warnings.length > 0) {
        console.warn(`⚠️ Validation warnings for ${formType} DSA Connector form:`, validationResult.warnings);
      }

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = images?.length || photos?.length || 0;
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for DSA/DST Connector verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(photo =>
          !photo.geoLocation ||
          !photo.geoLocation.latitude ||
          !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `dsa_connector_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        actualCaseId,
        'DSA_CONNECTOR',
        submissionId,
        userId
      );

      console.log(`✅ Processed ${uploadedImages.length} verification images for DSA/DST Connector verification`);

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'DSA_CONNECTOR',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Update case with verification data using detected verification outcome
      await query(`UPDATE cases SET status = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP, "verificationData" = $1, "verificationType" = 'DSA_CONNECTOR', "verificationOutcome" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`, [JSON.stringify(verificationData), verificationOutcome, actualCaseId]);
      const caseUpd = await query(`SELECT id, "caseId", status, "completedAt", "customerName", "backendContactNumber", address FROM cases WHERE id = $1`, [actualCaseId]);
      const updatedCase = caseUpd.rows[0];

      // Auto-calculate commission for completed case
      try {
        const { autoCalculateCommissionForCase } = await import('../controllers/commissionManagementController');
        await autoCalculateCommissionForCase(actualCaseId);
      } catch (error) {
        console.error('Error auto-calculating commission for DSA connector form:', error);
        // Don't fail the form submission if commission calculation fails
      }

      // Create comprehensive DSA/DST Connector verification report using all available fields
      const dbInsertData = {
        // Core case information
        case_id: actualCaseId,
        caseId: parseInt(updatedCase.caseId) || null,
        form_type: formType,
        verification_outcome: verificationOutcome,
        customer_name: updatedCase.customerName || 'Unknown',
        customer_phone: updatedCase.backendContactNumber || null,
        customer_email: null, // Not available from case data
        full_address: updatedCase.address || 'Address not provided',

        // Verification metadata
        verification_date: new Date().toISOString().split('T')[0],
        verification_time: new Date().toTimeString().split(' ')[0],
        verified_by: userId,
        total_images: uploadedImages.length || 0,
        total_selfies: uploadedImages.filter(img => img.photoType === 'selfie').length || 0,
        remarks: formData.remarks || `${formType} DSA/DST Connector verification completed`,

        // Merge all mapped form data
        ...mappedFormData
      };

      // Get valid database columns for DSA Connector verification
      const availableDbColumns = getDsaConnectorAvailableDbColumns();

      // Add essential system fields that are always required
      const essentialFields = [
        'case_id', 'caseId', 'form_type', 'verification_outcome',
        'customer_name', 'customer_phone', 'customer_email', 'full_address',
        'verification_date', 'verification_time', 'verified_by',
        'total_images', 'total_selfies', 'remarks'
      ];
      const allValidColumns = [...new Set([...availableDbColumns, ...essentialFields])];

      // Filter columns to only include valid database columns
      const filteredColumns = Object.keys(dbInsertData)
        .filter(key => dbInsertData[key] !== undefined)
        .filter(key => allValidColumns.includes(key));

      console.log('🔍 Filtered columns for SQL insert:', filteredColumns);

      // Build dynamic INSERT query based on filtered columns
      const columns = filteredColumns;
      const values = columns.map(key => dbInsertData[key]);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const columnNames = columns.map(col => `"${col}"`).join(', ');

      const insertQuery = `
        INSERT INTO "dsaConnectorVerificationReports" (${columnNames})
        VALUES (${placeholders})
      `;

      // Log comprehensive database insert data for debugging
      const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
      const populatedFields = Object.entries(dbInsertData).filter(([_, value]) =>
        value !== null && value !== undefined && value !== ''
      );

      console.log(`📝 Final database insert data for ${formType} DSA Connector verification:`, {
        totalFields: Object.keys(dbInsertData).length,
        populatedFields: populatedFields.length,
        fieldsWithNullValues: nullFields.length,
        fieldCoveragePercentage: Math.round((populatedFields.length / Object.keys(dbInsertData).length) * 100),
        nullFieldNames: nullFields.map(([key]) => key).slice(0, 10), // Show first 10 null fields
        samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)) // Show first 10 populated fields
      });

      console.log(`📝 Inserting DSA/DST Connector verification with ${columns.length} fields:`, columns);

      await query(insertQuery, values);

      // Remove auto-save data
      await query(`DELETE FROM "autoSaves" WHERE case_id = $1::uuid`, [actualCaseId]);

      await createAuditLog({
        action: 'DSA_CONNECTOR_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: actualCaseId,
        userId,
        details: {
          formType,
          verificationOutcome,
          imageCount: uploadedImages.length,
          submissionId,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      console.log(`✅ DSA/DST Connector verification completed successfully:`, {
        caseId: actualCaseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        actualCaseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} DSA/DST Connector verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      console.error('Submit DSA/DST Connector verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit property individual verification form
  static async submitPropertyIndividualVerification(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const { formData, attachmentIds, geoLocation, photos, images }: MobileFormSubmissionRequest = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      console.log(`📱 Property Individual verification submission for case: ${caseId}`);
      console.log(`   - User: ${userId} (${userRole})`);
      console.log(`   - Images: ${images?.length || 0}`);
      console.log(`   - Form data keys: ${Object.keys(formData || {}).join(', ')}`);
      console.log(`   - Form data outcome: ${formData?.outcome || formData?.finalStatus || 'Not specified'}`);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!caseId) {
        return res.status(400).json({
          success: false,
          message: 'Case ID is required',
          error: {
            code: 'CASE_ID_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!formData) {
        return res.status(400).json({
          success: false,
          message: 'Form data is required',
          error: {
            code: 'FORM_DATA_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate case exists and user has access
      const caseQuery = await query(`SELECT id, "caseId", "customerName", "assignedTo", address, "backendContactNumber" as "systemContact" FROM cases WHERE id = $1`, [caseId]);
      if (caseQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const existingCase = caseQuery.rows[0];
      const actualCaseId = existingCase.id;

      // Validate user assignment (allow admin users to submit for any case)
      if (userRole !== 'ADMIN' && existingCase.assignedTo !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this case',
          error: {
            code: 'CASE_NOT_ASSIGNED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.log(`✅ Case found: ${actualCaseId} (Case #${existingCase.caseId})`);

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = detectPropertyIndividualFormType(formData);

      console.log(`🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`);

      // Use comprehensive validation and preparation for Property Individual form data
      const { validationResult, preparedData } = validateAndPreparePropertyIndividualForm(formData, formType);

      // Log comprehensive validation results
      console.log(`📊 Comprehensive validation for ${formType} Property Individual verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage
      });

      // Generate and log field coverage report
      const coverageReport = generatePropertyIndividualFieldCoverageReport(formData, preparedData, formType);
      console.log(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        console.warn(`⚠️ Missing required fields for ${formType} Property Individual form:`, validationResult.missingFields);
      }
      if (validationResult.warnings.length > 0) {
        console.warn(`⚠️ Validation warnings for ${formType} Property Individual form:`, validationResult.warnings);
      }

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = images?.length || photos?.length || 0;
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for Property Individual verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(photo =>
          !photo.geoLocation ||
          !photo.geoLocation.latitude ||
          !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `property_individual_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        actualCaseId,
        'PROPERTY_INDIVIDUAL',
        submissionId,
        userId
      );

      console.log(`✅ Processed ${uploadedImages.length} verification images for Property Individual verification`);

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'PROPERTY_INDIVIDUAL',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Update case with verification data using detected verification outcome
      await query(`UPDATE cases SET status = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP, "verificationData" = $1, "verificationType" = 'PROPERTY_INDIVIDUAL', "verificationOutcome" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`, [JSON.stringify(verificationData), verificationOutcome, actualCaseId]);
      const caseUpd = await query(`SELECT id, "caseId", status, "completedAt", "customerName", "backendContactNumber", address FROM cases WHERE id = $1`, [actualCaseId]);
      const updatedCase = caseUpd.rows[0];

      // Create comprehensive Property Individual verification report using all available fields
      const dbInsertData = {
        // Core case information
        case_id: actualCaseId,
        caseId: parseInt(updatedCase.caseId) || null,
        form_type: formType,
        verification_outcome: verificationOutcome,
        customer_name: updatedCase.customerName || 'Unknown',
        customer_phone: updatedCase.backendContactNumber || null,
        customer_email: null, // Not available from case data
        full_address: updatedCase.address || 'Address not provided',

        // Verification metadata
        verification_date: new Date().toISOString().split('T')[0],
        verification_time: new Date().toTimeString().split(' ')[0],
        verified_by: userId,
        total_images: uploadedImages.length || 0,
        total_selfies: uploadedImages.filter(img => img.photoType === 'selfie').length || 0,
        remarks: formData.remarks || `${formType} Property Individual verification completed`,

        // Merge all mapped form data
        ...mappedFormData
      };

      // Build dynamic INSERT query based on available data
      const columns = Object.keys(dbInsertData).filter(key => dbInsertData[key] !== undefined);
      const values = columns.map(key => dbInsertData[key]);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const columnNames = columns.map(col => `"${col}"`).join(', ');

      const insertQuery = `
        INSERT INTO "propertyIndividualVerificationReports" (${columnNames})
        VALUES (${placeholders})
      `;

      // Log comprehensive database insert data for debugging
      const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
      const populatedFields = Object.entries(dbInsertData).filter(([_, value]) =>
        value !== null && value !== undefined && value !== ''
      );

      console.log(`📝 Final database insert data for ${formType} Property Individual verification:`, {
        totalFields: Object.keys(dbInsertData).length,
        populatedFields: populatedFields.length,
        fieldsWithNullValues: nullFields.length,
        fieldCoveragePercentage: Math.round((populatedFields.length / Object.keys(dbInsertData).length) * 100),
        nullFieldNames: nullFields.map(([key]) => key).slice(0, 10), // Show first 10 null fields
        samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)) // Show first 10 populated fields
      });

      console.log(`📝 Inserting Property Individual verification with ${columns.length} fields:`, columns);

      await query(insertQuery, values);

      // Remove auto-save data
      await query(`DELETE FROM "autoSaves" WHERE case_id = $1::uuid`, [actualCaseId]);

      await createAuditLog({
        action: 'PROPERTY_INDIVIDUAL_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: actualCaseId,
        userId,
        details: {
          formType,
          verificationOutcome,
          imageCount: uploadedImages.length,
          submissionId,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      console.log(`✅ Property Individual verification completed successfully:`, {
        caseId: actualCaseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        actualCaseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} Property Individual verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      console.error('Submit Property Individual verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit property APF verification form
  static async submitPropertyApfVerification(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const { formData, attachmentIds, geoLocation, photos, images }: MobileFormSubmissionRequest = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      console.log(`📱 Property APF verification submission for case: ${caseId}`);
      console.log(`   - User: ${userId} (${userRole})`);
      console.log(`   - Images: ${images?.length || 0}`);
      console.log(`   - Form data keys: ${Object.keys(formData || {}).join(', ')}`);
      console.log(`   - Form data outcome: ${formData?.outcome || formData?.finalStatus || 'Not specified'}`);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!caseId) {
        return res.status(400).json({
          success: false,
          message: 'Case ID is required',
          error: {
            code: 'CASE_ID_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!formData) {
        return res.status(400).json({
          success: false,
          message: 'Form data is required',
          error: {
            code: 'FORM_DATA_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate case exists and user has access
      const caseQuery = await query(`SELECT id, "caseId", "customerName", "assignedTo", address, "backendContactNumber" as "systemContact" FROM cases WHERE id = $1`, [caseId]);
      if (caseQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const existingCase = caseQuery.rows[0];
      const actualCaseId = existingCase.id;

      // Validate user assignment (allow admin users to submit for any case)
      if (userRole !== 'ADMIN' && existingCase.assignedTo !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this case',
          error: {
            code: 'CASE_NOT_ASSIGNED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.log(`✅ Case found: ${actualCaseId} (Case #${existingCase.caseId})`);

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = detectBusinessFormType(formData); // Use business detection for Property APF (similar structure)

      console.log(`🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`);

      // Use comprehensive validation and preparation for Property APF form data
      const { validationResult, preparedData } = validateAndPreparePropertyApfForm(formData, formType);

      // Log comprehensive validation results
      console.log(`📊 Comprehensive validation for ${formType} Property APF verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage
      });

      // Generate and log field coverage report
      const coverageReport = generatePropertyApfFieldCoverageReport(formData, preparedData, formType);
      console.log(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        console.warn(`⚠️ Missing required fields for ${formType} Property APF form:`, validationResult.missingFields);
      }
      if (validationResult.warnings.length > 0) {
        console.warn(`⚠️ Validation warnings for ${formType} Property APF form:`, validationResult.warnings);
      }

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = images?.length || photos?.length || 0;
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for Property APF verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(photo =>
          !photo.geoLocation ||
          !photo.geoLocation.latitude ||
          !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `property_apf_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        actualCaseId,
        'PROPERTY_APF',
        submissionId,
        userId
      );

      console.log(`✅ Processed ${uploadedImages.length} verification images for Property APF verification`);

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'PROPERTY_APF',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Update case with verification data using detected verification outcome
      await query(`UPDATE cases SET status = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP, "verificationData" = $1, "verificationType" = 'PROPERTY_APF', "verificationOutcome" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`, [JSON.stringify(verificationData), verificationOutcome, actualCaseId]);
      const caseUpd = await query(`SELECT id, "caseId", status, "completedAt", "customerName", "backendContactNumber", address FROM cases WHERE id = $1`, [actualCaseId]);
      const updatedCase = caseUpd.rows[0];

      // Create comprehensive Property APF verification report using all available fields
      const dbInsertData = {
        // Core case information
        case_id: actualCaseId,
        caseId: parseInt(updatedCase.caseId) || null,
        form_type: formType,
        verification_outcome: verificationOutcome,
        customer_name: updatedCase.customerName || 'Unknown',
        customer_phone: updatedCase.backendContactNumber || null,
        customer_email: null, // Not available from case data
        full_address: updatedCase.address || 'Address not provided',

        // Verification metadata
        verification_date: new Date().toISOString().split('T')[0],
        verification_time: new Date().toTimeString().split(' ')[0],
        verified_by: userId,
        total_images: uploadedImages.length || 0,
        total_selfies: uploadedImages.filter(img => img.photoType === 'selfie').length || 0,
        remarks: formData.remarks || `${formType} Property APF verification completed`,

        // Merge all mapped form data
        ...mappedFormData
      };

      // Get valid database columns for Property APF verification
      const availableDbColumns = getPropertyApfAvailableDbColumns();

      // Add essential system fields that are always required
      const essentialFields = [
        'case_id', 'caseId', 'form_type', 'verification_outcome',
        'customer_name', 'customer_phone', 'customer_email', 'full_address',
        'verification_date', 'verification_time', 'verified_by',
        'total_images', 'total_selfies', 'remarks'
      ];
      const allValidColumns = [...new Set([...availableDbColumns, ...essentialFields])];

      // Filter columns to only include valid database columns
      const filteredColumns = Object.keys(dbInsertData)
        .filter(key => dbInsertData[key] !== undefined)
        .filter(key => allValidColumns.includes(key));

      console.log('🔍 Filtered columns for SQL insert:', filteredColumns);

      // Build dynamic INSERT query based on filtered columns
      const columns = filteredColumns;
      const values = columns.map(key => dbInsertData[key]);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const columnNames = columns.map(col => `"${col}"`).join(', ');

      const insertQuery = `
        INSERT INTO "propertyApfVerificationReports" (${columnNames})
        VALUES (${placeholders})
      `;

      // Log comprehensive database insert data for debugging
      const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
      const populatedFields = Object.entries(dbInsertData).filter(([_, value]) =>
        value !== null && value !== undefined && value !== ''
      );

      console.log(`📝 Final database insert data for ${formType} Property APF verification:`, {
        totalFields: Object.keys(dbInsertData).length,
        populatedFields: populatedFields.length,
        fieldsWithNullValues: nullFields.length,
        fieldCoveragePercentage: Math.round((populatedFields.length / Object.keys(dbInsertData).length) * 100),
        nullFieldNames: nullFields.map(([key]) => key).slice(0, 10), // Show first 10 null fields
        samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)) // Show first 10 populated fields
      });

      console.log(`📝 Inserting Property APF verification with ${columns.length} fields:`, columns);

      await query(insertQuery, values);

      // Remove auto-save data
      await query(`DELETE FROM "autoSaves" WHERE case_id = $1::uuid`, [actualCaseId]);

      await createAuditLog({
        action: 'PROPERTY_APF_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: actualCaseId,
        userId,
        details: {
          formType,
          verificationOutcome,
          imageCount: uploadedImages.length,
          submissionId,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      console.log(`✅ Property APF verification completed successfully:`, {
        caseId: actualCaseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        actualCaseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} Property APF verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      console.error('Submit Property APF verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Submit NOC verification form
  static async submitNocVerification(req: Request, res: Response) {
    try {
      const { caseId } = req.params;
      const { formData, attachmentIds, geoLocation, photos, images }: MobileFormSubmissionRequest = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      console.log(`📱 NOC verification submission for case: ${caseId}`);
      console.log(`   - User: ${userId} (${userRole})`);
      console.log(`   - Images: ${images?.length || 0}`);
      console.log(`   - Form data keys: ${Object.keys(formData || {}).join(', ')}`);
      console.log(`   - Form data outcome: ${formData?.outcome || formData?.finalStatus || 'Not specified'}`);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User authentication required',
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!caseId) {
        return res.status(400).json({
          success: false,
          message: 'Case ID is required',
          error: {
            code: 'CASE_ID_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (!formData) {
        return res.status(400).json({
          success: false,
          message: 'Form data is required',
          error: {
            code: 'FORM_DATA_REQUIRED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate case exists and user has access
      const caseQuery = await query(`SELECT id, "caseId", "customerName", "assignedTo", address, "backendContactNumber" as "systemContact" FROM cases WHERE id = $1`, [caseId]);
      if (caseQuery.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Case not found',
          error: {
            code: 'CASE_NOT_FOUND',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const existingCase = caseQuery.rows[0];
      const actualCaseId = existingCase.id;

      // Validate user assignment (allow admin users to submit for any case)
      if (userRole !== 'ADMIN' && existingCase.assignedTo !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this case',
          error: {
            code: 'CASE_NOT_ASSIGNED',
            timestamp: new Date().toISOString(),
          },
        });
      }

      console.log(`✅ Case found: ${actualCaseId} (Case #${existingCase.caseId})`);

      // Determine form type and verification outcome based on form data
      const { formType, verificationOutcome } = detectBusinessFormType(formData); // Use business detection for NOC (similar structure)

      console.log(`🔍 Detected form type: ${formType}, verification outcome: ${verificationOutcome}`);

      // Use comprehensive validation and preparation for NOC form data
      const { validationResult, preparedData } = validateAndPrepareNocForm(formData, formType);

      // Log comprehensive validation results
      console.log(`📊 Comprehensive validation for ${formType} NOC verification:`, {
        isValid: validationResult.isValid,
        missingFields: validationResult.missingFields,
        warnings: validationResult.warnings,
        fieldCoverage: validationResult.fieldCoverage
      });

      // Generate and log field coverage report
      const coverageReport = generateNocFieldCoverageReport(formData, preparedData, formType);
      console.log(coverageReport);

      // Use the prepared data (which includes all fields with proper defaults)
      const mappedFormData = preparedData;

      // Log warnings if any
      if (!validationResult.isValid) {
        console.warn(`⚠️ Missing required fields for ${formType} NOC form:`, validationResult.missingFields);
      }
      if (validationResult.warnings.length > 0) {
        console.warn(`⚠️ Validation warnings for ${formType} NOC form:`, validationResult.warnings);
      }

      // Validate minimum photo requirement (≥5 geo-tagged photos)
      // Use images array for new submission format
      const photoCount = images?.length || photos?.length || 0;
      if (photoCount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Minimum 5 geo-tagged photos required for NOC verification',
          error: {
            code: 'INSUFFICIENT_PHOTOS',
            details: {
              required: 5,
              provided: photoCount,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Validate that all photos have geo-location (only if photos array exists)
      if (photos && photos.length > 0) {
        const photosWithoutGeo = photos.filter(photo =>
          !photo.geoLocation ||
          !photo.geoLocation.latitude ||
          !photo.geoLocation.longitude
        );

        if (photosWithoutGeo.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'All photos must have geo-location data',
            error: {
              code: 'MISSING_GEO_LOCATION',
              details: {
                photosWithoutGeo: photosWithoutGeo.length,
              },
              timestamp: new Date().toISOString(),
            },
          });
        }
      }

      // Generate unique submission ID
      const submissionId = `noc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Process verification images separately from case attachments
      const uploadedImages = await MobileFormController.processVerificationImages(
        images || [],
        actualCaseId,
        'NOC',
        submissionId,
        userId
      );

      console.log(`✅ Processed ${uploadedImages.length} verification images for NOC verification`);

      // Prepare verification data (excluding old attachment references)
      const verificationData = {
        formType: 'NOC',
        submissionId,
        submittedAt: new Date().toISOString(),
        submittedBy: userId,
        geoLocation,
        formData,
        verificationImages: uploadedImages.map(img => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          photoType: img.photoType,
          geoLocation: img.geoLocation,
        })),
        verification: {
          ...formData,
          imageCount: uploadedImages.length,
          geoTaggedImages: uploadedImages.filter(img => img.geoLocation).length,
          submissionLocation: geoLocation,
        },
      };

      // Update case with verification data using detected verification outcome
      await query(`UPDATE cases SET status = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP, "verificationData" = $1, "verificationType" = 'NOC', "verificationOutcome" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $3`, [JSON.stringify(verificationData), verificationOutcome, actualCaseId]);
      const caseUpd = await query(`SELECT id, "caseId", status, "completedAt", "customerName", "backendContactNumber", address FROM cases WHERE id = $1`, [actualCaseId]);
      const updatedCase = caseUpd.rows[0];

      // Create comprehensive NOC verification report using all available fields
      const dbInsertData = {
        // Core case information
        case_id: actualCaseId,
        caseId: parseInt(updatedCase.caseId) || null,
        form_type: formType,
        verification_outcome: verificationOutcome,
        customer_name: updatedCase.customerName || 'Unknown',
        customer_phone: updatedCase.backendContactNumber || null,
        customer_email: null, // Not available from case data
        full_address: updatedCase.address || 'Address not provided',

        // Verification metadata
        verification_date: new Date().toISOString().split('T')[0],
        verification_time: new Date().toTimeString().split(' ')[0],
        verified_by: userId,
        total_images: uploadedImages.length || 0,
        total_selfies: uploadedImages.filter(img => img.photoType === 'selfie').length || 0,
        remarks: formData.remarks || `${formType} NOC verification completed`,

        // Merge all mapped form data
        ...mappedFormData
      };

      // Get valid database columns for NOC verification
      const availableDbColumns = getNocAvailableDbColumns();

      // Add essential system fields that are always required
      const essentialFields = [
        'case_id', 'caseId', 'form_type', 'verification_outcome',
        'customer_name', 'customer_phone', 'customer_email', 'full_address',
        'verification_date', 'verification_time', 'verified_by',
        'total_images', 'total_selfies', 'remarks'
      ];
      const allValidColumns = [...new Set([...availableDbColumns, ...essentialFields])];

      // Filter columns to only include valid database columns
      const filteredColumns = Object.keys(dbInsertData)
        .filter(key => dbInsertData[key] !== undefined)
        .filter(key => allValidColumns.includes(key));

      console.log('🔍 Filtered columns for SQL insert:', filteredColumns);

      // Build dynamic INSERT query based on filtered columns
      const columns = filteredColumns;
      const values = columns.map(key => dbInsertData[key]);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const columnNames = columns.map(col => `"${col}"`).join(', ');

      const insertQuery = `
        INSERT INTO "nocVerificationReports" (${columnNames})
        VALUES (${placeholders})
      `;

      // Log comprehensive database insert data for debugging
      const nullFields = Object.entries(dbInsertData).filter(([_, value]) => value === null);
      const populatedFields = Object.entries(dbInsertData).filter(([_, value]) =>
        value !== null && value !== undefined && value !== ''
      );

      console.log(`📝 Final database insert data for ${formType} NOC verification:`, {
        totalFields: Object.keys(dbInsertData).length,
        populatedFields: populatedFields.length,
        fieldsWithNullValues: nullFields.length,
        fieldCoveragePercentage: Math.round((populatedFields.length / Object.keys(dbInsertData).length) * 100),
        nullFieldNames: nullFields.map(([key]) => key).slice(0, 10), // Show first 10 null fields
        samplePopulatedData: Object.fromEntries(populatedFields.slice(0, 10)) // Show first 10 populated fields
      });

      console.log(`📝 Inserting NOC verification with ${columns.length} fields:`, columns);

      await query(insertQuery, values);

      // Remove auto-save data
      await query(`DELETE FROM "autoSaves" WHERE case_id = $1::uuid`, [actualCaseId]);

      await createAuditLog({
        action: 'NOC_VERIFICATION_SUBMITTED',
        entityType: 'CASE',
        entityId: actualCaseId,
        userId,
        details: {
          formType,
          verificationOutcome,
          imageCount: uploadedImages.length,
          submissionId,
          hasGeoLocation: !!geoLocation,
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      console.log(`✅ NOC verification completed successfully:`, {
        caseId: actualCaseId,
        formType,
        verificationOutcome,
        imageCount: uploadedImages.length
      });

      // Send case completion notification to backend users
      await MobileFormController.sendCaseCompletionNotification(
        actualCaseId,
        updatedCase.caseId,
        updatedCase.customerName || 'Unknown Customer',
        userId,
        'COMPLETED',
        verificationOutcome
      );

      res.json({
        success: true,
        message: `${formType} NOC verification submitted successfully`,
        data: {
          caseId: updatedCase.id,
          caseNumber: updatedCase.caseId,
          status: updatedCase.status,
          completedAt: updatedCase.completedAt?.toISOString(),
          submissionId,
          formType,
          verificationOutcome,
          verificationImageCount: uploadedImages.length,
          verificationData,
        },
      });
    } catch (error) {
      console.error('Submit NOC verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'VERIFICATION_SUBMISSION_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  // Get verification form template
  static async getFormTemplate(req: Request, res: Response) {
    try {
      const { formType } = req.params;

      if (!['RESIDENCE', 'OFFICE', 'BUSINESS', 'BUILDER', 'RESIDENCE_CUM_OFFICE', 'DSA_CONNECTOR', 'PROPERTY_INDIVIDUAL', 'PROPERTY_APF', 'NOC'].includes(formType.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid form type',
          error: {
            code: 'INVALID_FORM_TYPE',
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Return form template based on type
      const templates = {
        RESIDENCE: {
          fields: [
            { name: 'applicantName', type: 'text', required: true, label: 'Applicant Name' },
            { name: 'addressConfirmed', type: 'boolean', required: true, label: 'Address Confirmed' },
            { name: 'residenceType', type: 'select', required: true, label: 'Residence Type', options: ['OWNED', 'RENTED', 'FAMILY'] },
            { name: 'familyMembers', type: 'number', required: false, label: 'Family Members' },
            { name: 'neighborVerification', type: 'boolean', required: true, label: 'Neighbor Verification' },
            { name: 'remarks', type: 'textarea', required: false, label: 'Remarks' },
            { name: 'outcome', type: 'select', required: true, label: 'Verification Outcome', options: ['VERIFIED', 'NOT_VERIFIED', 'PARTIAL'] },
          ],
          requiredPhotos: 5,
          photoTypes: ['BUILDING_EXTERIOR', 'BUILDING_INTERIOR', 'NAMEPLATE', 'SURROUNDINGS', 'APPLICANT'],
        },
        OFFICE: {
          fields: [
            { name: 'companyName', type: 'text', required: true, label: 'Company Name' },
            { name: 'designation', type: 'text', required: true, label: 'Designation' },
            { name: 'employeeId', type: 'text', required: false, label: 'Employee ID' },
            { name: 'workingHours', type: 'text', required: true, label: 'Working Hours' },
            { name: 'hrVerification', type: 'boolean', required: true, label: 'HR Verification' },
            { name: 'salaryConfirmed', type: 'boolean', required: false, label: 'Salary Confirmed' },
            { name: 'remarks', type: 'textarea', required: false, label: 'Remarks' },
            { name: 'outcome', type: 'select', required: true, label: 'Verification Outcome', options: ['VERIFIED', 'NOT_VERIFIED', 'PARTIAL'] },
          ],
          requiredPhotos: 5,
          photoTypes: ['OFFICE_EXTERIOR', 'OFFICE_INTERIOR', 'RECEPTION', 'EMPLOYEE_DESK', 'ID_CARD'],
        },
        BUSINESS: {
          fields: [
            { name: 'businessName', type: 'text', required: true, label: 'Business Name' },
            { name: 'businessType', type: 'text', required: true, label: 'Business Type' },
            { name: 'ownerName', type: 'text', required: true, label: 'Owner Name' },
            { name: 'businessAddress', type: 'text', required: true, label: 'Business Address' },
            { name: 'operatingHours', type: 'text', required: true, label: 'Operating Hours' },
            { name: 'employeeCount', type: 'number', required: false, label: 'Employee Count' },
            { name: 'remarks', type: 'textarea', required: false, label: 'Remarks' },
            { name: 'outcome', type: 'select', required: true, label: 'Verification Outcome', options: ['VERIFIED', 'NOT_VERIFIED', 'PARTIAL'] },
          ],
          requiredPhotos: 5,
          photoTypes: ['BUSINESS_EXTERIOR', 'BUSINESS_INTERIOR', 'SIGNBOARD', 'OWNER_PHOTO', 'BUSINESS_ACTIVITY'],
        },
        BUILDER: {
          fields: [
            { name: 'builderName', type: 'text', required: true, label: 'Builder Name' },
            { name: 'projectName', type: 'text', required: true, label: 'Project Name' },
            { name: 'projectAddress', type: 'text', required: true, label: 'Project Address' },
            { name: 'constructionStatus', type: 'select', required: true, label: 'Construction Status', options: ['UNDER_CONSTRUCTION', 'COMPLETED', 'PLANNED'] },
            { name: 'approvals', type: 'text', required: false, label: 'Approvals' },
            { name: 'remarks', type: 'textarea', required: false, label: 'Remarks' },
            { name: 'outcome', type: 'select', required: true, label: 'Verification Outcome', options: ['VERIFIED', 'NOT_VERIFIED', 'PARTIAL'] },
          ],
          requiredPhotos: 5,
          photoTypes: ['PROJECT_EXTERIOR', 'CONSTRUCTION_SITE', 'APPROVAL_BOARD', 'BUILDER_OFFICE', 'PROGRESS_PHOTO'],
        },
        RESIDENCE_CUM_OFFICE: {
          fields: [
            { name: 'applicantName', type: 'text', required: true, label: 'Applicant Name' },
            { name: 'residenceConfirmed', type: 'boolean', required: true, label: 'Residence Confirmed' },
            { name: 'officeConfirmed', type: 'boolean', required: true, label: 'Office Confirmed' },
            { name: 'businessType', type: 'text', required: false, label: 'Business Type' },
            { name: 'workingHours', type: 'text', required: false, label: 'Working Hours' },
            { name: 'remarks', type: 'textarea', required: false, label: 'Remarks' },
            { name: 'outcome', type: 'select', required: true, label: 'Verification Outcome', options: ['VERIFIED', 'NOT_VERIFIED', 'PARTIAL'] },
          ],
          requiredPhotos: 5,
          photoTypes: ['BUILDING_EXTERIOR', 'RESIDENCE_AREA', 'OFFICE_AREA', 'NAMEPLATE', 'APPLICANT'],
        },
        DSA_CONNECTOR: {
          fields: [
            { name: 'connectorName', type: 'text', required: true, label: 'Connector Name' },
            { name: 'connectorType', type: 'select', required: true, label: 'Connector Type', options: ['DSA', 'DST'] },
            { name: 'officeAddress', type: 'text', required: true, label: 'Office Address' },
            { name: 'contactPerson', type: 'text', required: true, label: 'Contact Person' },
            { name: 'businessVolume', type: 'text', required: false, label: 'Business Volume' },
            { name: 'remarks', type: 'textarea', required: false, label: 'Remarks' },
            { name: 'outcome', type: 'select', required: true, label: 'Verification Outcome', options: ['VERIFIED', 'NOT_VERIFIED', 'PARTIAL'] },
          ],
          requiredPhotos: 5,
          photoTypes: ['OFFICE_EXTERIOR', 'OFFICE_INTERIOR', 'SIGNBOARD', 'CONTACT_PERSON', 'DOCUMENTS'],
        },
        PROPERTY_INDIVIDUAL: {
          fields: [
            { name: 'propertyOwner', type: 'text', required: true, label: 'Property Owner' },
            { name: 'propertyType', type: 'select', required: true, label: 'Property Type', options: ['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL'] },
            { name: 'propertyAddress', type: 'text', required: true, label: 'Property Address' },
            { name: 'propertyValue', type: 'number', required: false, label: 'Property Value' },
            { name: 'ownershipStatus', type: 'select', required: true, label: 'Ownership Status', options: ['OWNED', 'LEASED', 'RENTED'] },
            { name: 'remarks', type: 'textarea', required: false, label: 'Remarks' },
            { name: 'outcome', type: 'select', required: true, label: 'Verification Outcome', options: ['VERIFIED', 'NOT_VERIFIED', 'PARTIAL'] },
          ],
          requiredPhotos: 5,
          photoTypes: ['PROPERTY_EXTERIOR', 'PROPERTY_INTERIOR', 'OWNERSHIP_DOCS', 'OWNER_PHOTO', 'SURROUNDINGS'],
        },
        PROPERTY_APF: {
          fields: [
            { name: 'projectName', type: 'text', required: true, label: 'Project Name' },
            { name: 'developerName', type: 'text', required: true, label: 'Developer Name' },
            { name: 'projectAddress', type: 'text', required: true, label: 'Project Address' },
            { name: 'projectStatus', type: 'select', required: true, label: 'Project Status', options: ['UNDER_CONSTRUCTION', 'COMPLETED', 'PLANNED'] },
            { name: 'approvalStatus', type: 'text', required: false, label: 'Approval Status' },
            { name: 'remarks', type: 'textarea', required: false, label: 'Remarks' },
            { name: 'outcome', type: 'select', required: true, label: 'Verification Outcome', options: ['VERIFIED', 'NOT_VERIFIED', 'PARTIAL'] },
          ],
          requiredPhotos: 5,
          photoTypes: ['PROJECT_EXTERIOR', 'CONSTRUCTION_SITE', 'APPROVAL_BOARD', 'DEVELOPER_OFFICE', 'PROGRESS_PHOTO'],
        },
        NOC: {
          fields: [
            { name: 'applicantName', type: 'text', required: true, label: 'Applicant Name' },
            { name: 'nocType', type: 'text', required: true, label: 'NOC Type' },
            { name: 'propertyAddress', type: 'text', required: true, label: 'Property Address' },
            { name: 'nocStatus', type: 'select', required: true, label: 'NOC Status', options: ['APPROVED', 'PENDING', 'REJECTED'] },
            { name: 'issuingAuthority', type: 'text', required: false, label: 'Issuing Authority' },
            { name: 'remarks', type: 'textarea', required: false, label: 'Remarks' },
            { name: 'outcome', type: 'select', required: true, label: 'Verification Outcome', options: ['VERIFIED', 'NOT_VERIFIED', 'PARTIAL'] },
          ],
          requiredPhotos: 5,
          photoTypes: ['PROPERTY_EXTERIOR', 'NOC_DOCUMENT', 'APPLICANT_PHOTO', 'AUTHORITY_OFFICE', 'SUPPORTING_DOCS'],
        },
      };

      res.json({
        success: true,
        message: 'Form template retrieved successfully',
        data: templates[formType.toUpperCase() as keyof typeof templates],
      });
    } catch (error) {
      console.error('Get form template error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: {
          code: 'TEMPLATE_FETCH_FAILED',
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}
