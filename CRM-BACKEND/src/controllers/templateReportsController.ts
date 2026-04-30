import type { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { templateReportService } from '../services/TemplateReportService';
import { query as dbQuery } from '../config/database';
import { storage, StorageKeys } from '../services/storage';
import type { AuthenticatedRequest } from '../middleware/auth';

/**
 * Template-based Reports Controller
 * Handles generation and management of template-based verification reports
 */

/**
 * Helper function to normalize verification type names for template matching
 * Converts full database names like "Business Verification" to short codes like "BUSINESS"
 */
function normalizeVerificationType(verificationType: string): string {
  const typeUpper = verificationType.toUpperCase();

  // Check for combined types first
  if (typeUpper.includes('RESIDENCE') && typeUpper.includes('OFFICE')) {
    return 'RESIDENCE_CUM_OFFICE';
  }

  // Check for individual types
  if (typeUpper.includes('RESIDENCE')) {
    return 'RESIDENCE';
  }
  if (typeUpper.includes('OFFICE')) {
    return 'OFFICE';
  }
  if (typeUpper.includes('BUSINESS')) {
    return 'BUSINESS';
  }
  if (typeUpper.includes('BUILDER')) {
    return 'BUILDER';
  }
  if (typeUpper.includes('NOC')) {
    return 'NOC';
  }
  if (typeUpper.includes('DSA') || typeUpper.includes('CONNECTOR')) {
    return 'DSA_CONNECTOR';
  }
  if (typeUpper.includes('PROPERTY') && typeUpper.includes('APF')) {
    return 'PROPERTY_APF';
  }
  if (typeUpper.includes('PROPERTY') && typeUpper.includes('INDIVIDUAL')) {
    return 'PROPERTY_INDIVIDUAL';
  }

  // Default fallback
  return 'RESIDENCE';
}

/**
 * Generate template-based report for a form submission
 */
export async function generateTemplateReport(req: AuthenticatedRequest, res: Response) {
  try {
    const caseId = String(req.params.caseId || '');
    const submissionId = String(req.params.submissionId || '');
    const userId = req.user!.id;

    logger.info('Generating template report for form submission', {
      caseId,
      submissionId,
      userId,
    });

    // Get case details
    // Handle both UUID and integer caseId
    // 2026-04-28 PE8 (F5.1.1 follow-up): cases.verification_type text column
    // dropped — derive from verification_types FK.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(caseId);
    const caseQuery = isUuid
      ? `SELECT c.id, c.customer_name, c.verification_data, vtype.name AS verification_type, c.verification_outcome, c.status
         FROM cases c LEFT JOIN verification_types vtype ON vtype.id = c.verification_type_id
         WHERE c.id = $1`
      : `SELECT c.id, c.customer_name, c.verification_data, vtype.name AS verification_type, c.verification_outcome, c.status
         FROM cases c LEFT JOIN verification_types vtype ON vtype.id = c.verification_type_id
         WHERE c.case_id = $1`;
    const caseResult = await dbQuery(caseQuery, [isUuid ? caseId : parseInt(caseId)]);

    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = caseResult.rows[0];

    // Find verification task via task_form_submissions (submissionId = form_submission_id)
    // Falls back to verification_attachments.submissionId for legacy data
    const taskQuery = `
      SELECT DISTINCT vt.id as task_id, vt.verification_type_id, vtype.name as verification_type_name
      FROM verification_tasks vt
      LEFT JOIN verification_types vtype ON vt.verification_type_id = vtype.id
      WHERE vt.case_id = $1 AND (
        vt.id IN (SELECT verification_task_id FROM task_form_submissions WHERE form_submission_id::text = $2)
        OR vt.id IN (SELECT verification_task_id FROM verification_attachments WHERE submission_id = $2)
      )
      LIMIT 1
    `;
    const taskResult = await dbQuery(taskQuery, [caseData.id, submissionId]);

    if (taskResult.rows.length === 0) {
      // Last resort: just get the first task for this case
      const fallbackResult = await dbQuery(
        `SELECT vt.id as task_id, vt.verification_type_id, vtype.name as verification_type_name
         FROM verification_tasks vt
         LEFT JOIN verification_types vtype ON vt.verification_type_id = vtype.id
         WHERE vt.case_id = $1 LIMIT 1`,
        [caseData.id]
      );
      if (fallbackResult.rows.length === 0) {
        logger.error('Verification task not found for submission', { caseId, submissionId });
        return res.status(404).json({ error: 'Verification task not found for this submission' });
      }
      taskResult.rows = fallbackResult.rows;
    }

    const taskData = taskResult.rows[0];
    // Camelize transform (Phase B3, REPLACING) deletes snake keys —
    // SQL aliases `task_id` and `verification_type_name` become camelCase
    // properties on the row object. Reading snake here returns undefined
    // → verificationTaskId is null → office query returns 0 rows →
    // formData stays empty → every field renders blank in the report.
    const verificationTaskId = taskData.taskId;
    const verificationType = taskData.verificationTypeName || caseData.verificationType;

    let outcome = caseData.verificationOutcome;
    let formData: Record<string, unknown> = {};

    // Extract address from verificationData
    const address =
      caseData.verificationData?.address ||
      caseData.verificationData?.formData?.address ||
      caseData.verificationData?.verification?.address ||
      'Address not available';

    // Get verification report data based on verification type using verification_task_id
    const typeUpper = verificationType.toUpperCase();

    if (typeUpper.includes('RESIDENCE') && !typeUpper.includes('OFFICE')) {
      const residenceQuery = `
        SELECT * FROM verification_reports
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const residenceResult = await dbQuery(residenceQuery, [verificationTaskId]);

      if (residenceResult.rows.length > 0) {
        const residenceData = residenceResult.rows[0];
        outcome = residenceData.verificationOutcome;

        // Map residence verification data to form data structure
        formData = {
          customerName: residenceData.customerName,
          addressLocatable: residenceData.addressLocatable,
          addressRating: residenceData.addressRating,
          houseStatus: residenceData.houseStatus,
          metPersonName: residenceData.metPersonName,
          metPersonRelation: residenceData.metPersonRelation,
          metPersonStatus: residenceData.metPersonStatus,
          stayingPeriod: residenceData.stayingPeriod,
          stayingStatus: residenceData.stayingStatus,
          totalFamilyMembers: residenceData.totalFamilyMembers,
          totalEarningMember: residenceData.totalEarningMember,
          workingStatus: residenceData.workingStatus,
          companyName: residenceData.companyName,
          approxArea: residenceData.approxArea,
          doorNamePlateStatus: residenceData.doorNamePlateStatus,
          nameOnDoorPlate: residenceData.nameOnDoorPlate,
          societyNamePlateStatus: residenceData.societyNamePlateStatus,
          nameOnSocietyBoard: residenceData.nameOnSocietyBoard,
          locality: residenceData.locality,
          addressStructure: residenceData.addressStructure,
          applicantStayingFloor: residenceData.applicantStayingFloor,
          addressFloor: residenceData.addressFloor,
          addressStructureColor: residenceData.addressStructureColor,
          doorColor: residenceData.doorColor,
          documentType: residenceData.documentType,
          tpcMetPerson1: residenceData.tpcMetPerson1,
          tpcName1: residenceData.tpcName1,
          tpcConfirmation1: residenceData.tpcConfirmation1,
          tpcMetPerson2: residenceData.tpcMetPerson2,
          tpcName2: residenceData.tpcName2,
          tpcConfirmation2: residenceData.tpcConfirmation2,
          landmark1: residenceData.landmark1,
          landmark2: residenceData.landmark2,
          dominatedArea: residenceData.dominatedArea,
          feedbackFromNeighbour: residenceData.feedbackFromNeighbour,
          politicalConnection: residenceData.politicalConnection,
          otherObservation: residenceData.otherObservation,
          finalStatus: residenceData.finalStatus,
          // Shifted-specific
          shiftedPeriod: residenceData.shiftedPeriod,
          currentLocation: residenceData.currentLocation,
          premisesStatus: residenceData.premisesStatus,
          stayingPersonName: residenceData.stayingPersonName,
          roomStatus: residenceData.roomStatus,
          // ERT-specific
          nameOfMetPerson: residenceData.metPersonName,
          metPersonType: residenceData.metPersonType,
          metPersonConfirmation: residenceData.metPersonConfirmation,
          applicantStayingStatus: residenceData.applicantStayingStatus,
          // Untraceable-specific
          contactPerson: residenceData.contactPerson,
          callRemark: residenceData.callRemark,
          // Extra landmarks
          landmark3: residenceData.landmark3,
          landmark4: residenceData.landmark4,
          // Nameplates & documents
          companyNamePlateStatus: residenceData.companyNamePlateStatus,
          nameOnBoard: residenceData.nameOnBoard,
          documentShown: residenceData.documentShown,
          // Status fields
          recommendationStatus: residenceData.recommendationStatus,
        };
      }
    } else if (typeUpper.includes('OFFICE') && !typeUpper.includes('RESIDENCE')) {
      const officeQuery = `
        SELECT * FROM verification_reports
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const officeResult = await dbQuery(officeQuery, [verificationTaskId]);

      if (officeResult.rows.length > 0) {
        const officeData = officeResult.rows[0];
        outcome = officeData.verificationOutcome;

        // Map office verification data to form data structure
        formData = {
          customerName: officeData.customerName,
          addressLocatable: officeData.addressLocatable,
          addressRating: officeData.addressRating,
          officeStatus: officeData.officeStatus,
          metPersonName: officeData.metPersonName,
          metPersonDesignation: officeData.metPersonDesignation,
          workingPeriod: officeData.workingPeriod,
          applicantDesignation: officeData.applicantDesignation,
          applicantWorkingPremises: officeData.applicantWorkingPremises,
          sittingLocation: officeData.sittingLocation,
          officeType: officeData.officeType,
          companyNatureOfBusiness: officeData.companyNatureOfBusiness,
          staffStrength: officeData.staffStrength,
          staffSeen: officeData.staffSeen,
          officeApproxArea: officeData.officeApproxArea,
          companyNamePlateStatus: officeData.companyNamePlateStatus,
          nameOnBoard: officeData.nameOnBoard,
          locality: officeData.locality,
          addressStructure: officeData.addressStructure,
          addressStructureColor: officeData.addressStructureColor,
          doorColor: officeData.doorColor,
          tpcMetPerson1: officeData.tpcMetPerson1,
          tpcName1: officeData.tpcName1,
          tpcConfirmation1: officeData.tpcConfirmation1,
          tpcMetPerson2: officeData.tpcMetPerson2,
          tpcName2: officeData.tpcName2,
          tpcConfirmation2: officeData.tpcConfirmation2,
          landmark1: officeData.landmark1,
          landmark2: officeData.landmark2,
          dominatedArea: officeData.dominatedArea,
          feedbackFromNeighbour: officeData.feedbackFromNeighbour,
          politicalConnection: officeData.politicalConnection,
          otherObservation: officeData.otherObservation,
          finalStatus: officeData.finalStatus,

          // ERT-specific fields
          metPersonType: officeData.metPersonType,
          nameOfMetPerson: officeData.metPersonName,
          metPersonConfirmation: officeData.metPersonConfirmation,
          addressFloor: officeData.addressFloor,

          // SHIFTED-specific fields
          oldOfficeShiftedPeriod: officeData.oldOfficeShiftedPeriod,
          currentCompanyName: officeData.currentCompanyName,
          currentCompanyPeriod: officeData.currentCompanyPeriod,
          shiftedPeriod: officeData.shiftedPeriod,
          premisesStatus: officeData.premisesStatus,

          // UNTRACEABLE-specific fields
          callRemark: officeData.callRemark,
          contactPerson: officeData.contactPerson,
          landmark3: officeData.landmark3,
          landmark4: officeData.landmark4,

          // NSP-specific fields
          officeExistence: officeData.officeExistence,

          // Document & work fields
          documentType: officeData.documentType,
          documentShown: officeData.documentShown,
          workingStatus: officeData.workingStatus,
          businessPeriod: officeData.businessPeriod,
          establishmentPeriod: officeData.establishmentPeriod,
          applicantWorkingStatus: officeData.applicantWorkingStatus,

          // Status fields
          recommendationStatus: officeData.recommendationStatus,
        };
      }
    } else if (typeUpper.includes('BUSINESS')) {
      const businessQuery = `
        SELECT * FROM verification_reports
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const businessResult = await dbQuery(businessQuery, [verificationTaskId]);

      if (businessResult.rows.length > 0) {
        const businessData = businessResult.rows[0];
        outcome = businessData.verificationOutcome;

        // Map business verification data to form data structure
        formData = {
          customerName: businessData.customerName,
          addressLocatable: businessData.addressLocatable,
          addressRating: businessData.addressRating,
          locality: businessData.locality,
          addressStructure: businessData.addressStructure,
          addressFloor: businessData.addressFloor,
          addressStructureColor: businessData.addressStructureColor,
          doorColor: businessData.doorColor,
          landmark1: businessData.landmark1,
          landmark2: businessData.landmark2,
          landmark3: businessData.landmark3,
          landmark4: businessData.landmark4,
          // Business details
          businessStatus: businessData.businessStatus,
          businessType: businessData.businessType,
          addressStatus: businessData.addressStatus,
          ownershipType: businessData.ownershipType,
          businessExistence: businessData.businessExistence,
          companyNatureOfBusiness: businessData.companyNatureOfBusiness,
          businessPeriod: businessData.businessPeriod,
          establishmentPeriod: businessData.establishmentPeriod,
          businessApproxArea: businessData.businessApproxArea,
          staffStrength: businessData.staffStrength,
          staffSeen: businessData.staffSeen,
          // Person details
          metPersonName: businessData.metPersonName,
          metPersonDesignation: businessData.metPersonDesignation,
          applicantDesignation: businessData.applicantDesignation,
          workingPeriod: businessData.workingPeriod,
          workingStatus: businessData.workingStatus,
          applicantWorkingPremises: businessData.applicantWorkingPremises,
          ownerName: businessData.ownerName,
          businessOwnerName: businessData.businessOwnerName,
          nameOfCompanyOwners: businessData.nameOfCompanyOwners,
          businessActivity: businessData.businessActivity,
          businessSetup: businessData.businessSetup,
          // Nameplate
          companyNamePlateStatus: businessData.companyNamePlateStatus,
          nameOnBoard: businessData.nameOnBoard,
          // Document
          documentShown: businessData.documentShown,
          documentType: businessData.documentType,
          // TPC
          tpcMetPerson1: businessData.tpcMetPerson1,
          tpcName1: businessData.tpcName1,
          tpcConfirmation1: businessData.tpcConfirmation1,
          tpcMetPerson2: businessData.tpcMetPerson2,
          tpcName2: businessData.tpcName2,
          tpcConfirmation2: businessData.tpcConfirmation2,
          // Shifted
          shiftedPeriod: businessData.shiftedPeriod,
          oldBusinessShiftedPeriod: businessData.oldBusinessShiftedPeriod,
          currentCompanyName: businessData.currentCompanyName,
          currentCompanyPeriod: businessData.currentCompanyPeriod,
          premisesStatus: businessData.premisesStatus,
          // Entry restricted
          nameOfMetPerson: businessData.metPersonName,
          metPersonType: businessData.metPersonType,
          metPersonConfirmation: businessData.metPersonConfirmation,
          applicantWorkingStatus: businessData.applicantWorkingStatus,
          // Untraceable
          contactPerson: businessData.contactPerson,
          callRemark: businessData.callRemark,
          // Area assessment
          dominatedArea: businessData.dominatedArea,
          feedbackFromNeighbour: businessData.feedbackFromNeighbour,
          politicalConnection: businessData.politicalConnection,
          otherObservation: businessData.otherObservation,
          otherExtraRemark: businessData.otherExtraRemark,
          recommendationStatus: businessData.recommendationStatus,
          finalStatus: businessData.finalStatus,
        };
      }
    } else if (typeUpper.includes('RESIDENCE') && typeUpper.includes('OFFICE')) {
      const residenceCumOfficeQuery = `
        SELECT * FROM verification_reports
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const residenceCumOfficeResult = await dbQuery(residenceCumOfficeQuery, [verificationTaskId]);

      if (residenceCumOfficeResult.rows.length > 0) {
        const rcData = residenceCumOfficeResult.rows[0];
        outcome = rcData.verificationOutcome;

        // Map residence cum office verification data to form data structure
        formData = {
          customerName: rcData.customerName,
          addressLocatable: rcData.addressLocatable,
          addressRating: rcData.addressRating,
          houseStatus: rcData.houseStatus,
          officeStatus: rcData.officeStatus,
          metPersonName: rcData.metPersonName,
          metPersonRelation: rcData.metPersonRelation,
          metPersonStatus: rcData.metPersonStatus,
          stayingPeriod: rcData.stayingPeriod,
          stayingStatus: rcData.stayingStatus,
          stayingPersonName: rcData.stayingPersonName,
          totalFamilyMembers: rcData.totalFamilyMembers,
          totalEarningMember: rcData.totalEarningMember,
          workingStatus: rcData.workingStatus,
          workingPeriod: rcData.workingPeriod,
          approxArea: rcData.approxArea,
          // Res-cum-Office-specific spec fields (added 2026-04-18)
          resiCumOfficeStatus:
            rcData.resiCumOfficeStatus || rcData.houseStatus || rcData.officeStatus,
          residenceSetup: rcData.residenceSetup,
          businessSetup: rcData.businessSetup,
          businessStatus: rcData.businessStatus,
          businessLocation: rcData.sittingLocation,
          businessOperatingAddress: rcData.businessOperatingAddress,
          companyName: rcData.companyName,
          // Office fields
          officeType: rcData.officeType,
          // 2026-04-28: dropped `designation: rcData.designation` — RCO never
          // captured designation (mobile form has metPersonRelation, not
          // metPersonDesignation). Live DB has no `designation` column. Read
          // was always undefined.
          applicantDesignation: rcData.applicantDesignation,
          companyNatureOfBusiness: rcData.companyNatureOfBusiness,
          businessPeriod: rcData.businessPeriod,
          establishmentPeriod: rcData.establishmentPeriod,
          staffStrength: rcData.staffStrength,
          staffSeen: rcData.staffSeen,
          applicantWorkingPremises: rcData.applicantWorkingPremises,
          sittingLocation: rcData.sittingLocation,
          currentCompanyName: rcData.currentCompanyName,
          currentCompanyPeriod: rcData.currentCompanyPeriod,
          // Nameplates
          doorNamePlateStatus: rcData.doorNamePlateStatus,
          nameOnDoorPlate: rcData.nameOnDoorPlate,
          societyNamePlateStatus: rcData.societyNamePlateStatus,
          nameOnSocietyBoard: rcData.nameOnSocietyBoard,
          companyNamePlateStatus: rcData.companyNamePlateStatus,
          nameOnBoard: rcData.nameOnBoard,
          // Location
          locality: rcData.locality,
          addressStructure: rcData.addressStructure,
          addressFloor: rcData.addressFloor,
          addressStructureColor: rcData.addressStructureColor,
          doorColor: rcData.doorColor,
          // Document
          documentShown: rcData.documentShown,
          documentType: rcData.documentType,
          // TPC
          tpcMetPerson1: rcData.tpcMetPerson1,
          tpcName1: rcData.tpcName1,
          tpcConfirmation1: rcData.tpcConfirmation1,
          tpcMetPerson2: rcData.tpcMetPerson2,
          tpcName2: rcData.tpcName2,
          tpcConfirmation2: rcData.tpcConfirmation2,
          // Entry restricted
          nameOfMetPerson: rcData.metPersonName,
          metPersonType: rcData.metPersonType,
          metPersonConfirmation: rcData.metPersonConfirmation,
          applicantStayingStatus: rcData.applicantStayingStatus,
          applicantWorkingStatus: rcData.applicantWorkingStatus,
          // Shifted
          shiftedPeriod: rcData.shiftedPeriod,
          oldOfficeShiftedPeriod: rcData.oldOfficeShiftedPeriod,
          premisesStatus: rcData.premisesStatus,
          currentLocation: rcData.currentLocation,
          // NSP
          officeExistence: rcData.officeExistence,
          // Untraceable
          contactPerson: rcData.contactPerson,
          callRemark: rcData.callRemark,
          // Landmarks
          landmark1: rcData.landmark1,
          landmark2: rcData.landmark2,
          landmark3: rcData.landmark3,
          landmark4: rcData.landmark4,
          // Area assessment
          dominatedArea: rcData.dominatedArea,
          feedbackFromNeighbour: rcData.feedbackFromNeighbour,
          politicalConnection: rcData.politicalConnection,
          otherObservation: rcData.otherObservation,
          otherExtraRemark: rcData.otherExtraRemark,
          recommendationStatus: rcData.recommendationStatus,
          finalStatus: rcData.finalStatus,
        };
      }
    } else if (typeUpper.includes('BUILDER')) {
      const builderQuery = `
        SELECT * FROM verification_reports
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const builderResult = await dbQuery(builderQuery, [verificationTaskId]);

      if (builderResult.rows.length > 0) {
        const builderData = builderResult.rows[0];
        outcome = builderData.verificationOutcome;

        // Map builder verification data to form data structure
        formData = {
          customerName: builderData.customerName,
          addressLocatable: builderData.addressLocatable,
          addressRating: builderData.addressRating,
          locality: builderData.locality,
          addressStructure: builderData.addressStructure,
          addressFloor: builderData.addressFloor,
          addressStructureColor: builderData.addressStructureColor,
          doorColor: builderData.doorColor,
          landmark1: builderData.landmark1,
          landmark2: builderData.landmark2,
          landmark3: builderData.landmark3,
          landmark4: builderData.landmark4,
          // Builder details
          officeStatus: builderData.officeStatus,
          officeExistence: builderData.officeExistence,
          builderType: builderData.builderType,
          builderName: builderData.builderName,
          builderOwnerName: builderData.builderOwnerName,
          companyNatureOfBusiness: builderData.companyNatureOfBusiness,
          businessPeriod: builderData.businessPeriod,
          establishmentPeriod: builderData.establishmentPeriod,
          officeApproxArea: builderData.officeApproxArea,
          staffStrength: builderData.staffStrength,
          staffSeen: builderData.staffSeen,
          // Person details
          metPersonName: builderData.metPersonName,
          metPersonDesignation: builderData.metPersonDesignation,
          applicantDesignation: builderData.applicantDesignation,
          workingPeriod: builderData.workingPeriod,
          workingStatus: builderData.workingStatus,
          // Nameplate
          companyNamePlateStatus: builderData.companyNamePlateStatus,
          nameOnBoard: builderData.nameOnBoard,
          // Document
          documentShown: builderData.documentShown,
          // TPC
          tpcMetPerson1: builderData.tpcMetPerson1,
          tpcName1: builderData.tpcName1,
          tpcConfirmation1: builderData.tpcConfirmation1,
          tpcMetPerson2: builderData.tpcMetPerson2,
          tpcName2: builderData.tpcName2,
          tpcConfirmation2: builderData.tpcConfirmation2,
          // Entry restricted
          nameOfMetPerson: builderData.metPersonName,
          metPersonType: builderData.metPersonType,
          metPersonConfirmation: builderData.metPersonConfirmation,
          applicantWorkingStatus: builderData.applicantWorkingStatus,
          // Shifted
          shiftedPeriod: builderData.shiftedPeriod,
          oldOfficeShiftedPeriod: builderData.oldOfficeShiftedPeriod,
          currentCompanyName: builderData.currentCompanyName,
          currentCompanyPeriod: builderData.currentCompanyPeriod,
          premisesStatus: builderData.premisesStatus,
          // Untraceable
          contactPerson: builderData.contactPerson,
          callRemark: builderData.callRemark,
          // Area assessment
          dominatedArea: builderData.dominatedArea,
          feedbackFromNeighbour: builderData.feedbackFromNeighbour,
          politicalConnection: builderData.politicalConnection,
          otherObservation: builderData.otherObservation,
          otherExtraRemark: builderData.otherExtraRemark,
          recommendationStatus: builderData.recommendationStatus,
          finalStatus: builderData.finalStatus,
        };
      }
    } else if (typeUpper.includes('NOC')) {
      const nocQuery = `
        SELECT * FROM verification_reports
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const nocResult = await dbQuery(nocQuery, [verificationTaskId]);

      if (nocResult.rows.length > 0) {
        const nocData = nocResult.rows[0];
        outcome = nocData.verificationOutcome;

        // Map NOC verification data to form data structure
        formData = {
          customerName: nocData.customerName,
          addressLocatable: nocData.addressLocatable,
          addressRating: nocData.addressRating,
          locality: nocData.locality,
          addressStructure: nocData.addressStructure,
          addressFloor: nocData.addressFloor,
          addressStructureColor: nocData.addressStructureColor,
          doorColor: nocData.doorColor,
          landmark1: nocData.landmark1,
          landmark2: nocData.landmark2,
          landmark3: nocData.landmark3,
          landmark4: nocData.landmark4,
          // NOC details
          officeStatus: nocData.officeStatus,
          nocStatus: nocData.nocStatus,
          nocType: nocData.nocType,
          nocNumber: nocData.nocNumber,
          nocIssueDate: nocData.nocIssueDate,
          nocExpiryDate: nocData.nocExpiryDate,
          nocIssuingAuthority: nocData.nocIssuingAuthority,
          nocValidityStatus: nocData.nocValidityStatus,
          // Property/Project
          propertyType: nocData.propertyType,
          projectName: nocData.projectName,
          projectStatus: nocData.projectStatus,
          constructionStatus: nocData.constructionStatus,
          projectApprovalStatus: nocData.projectApprovalStatus,
          totalUnits: nocData.totalUnits,
          completedUnits: nocData.completedUnits,
          soldUnits: nocData.soldUnits,
          possessionStatus: nocData.possessionStatus,
          // Builder/Developer
          builderName: nocData.builderName,
          builderContact: nocData.builderContact,
          developerName: nocData.developerName,
          developerContact: nocData.developerContact,
          builderRegistrationNumber: nocData.builderRegistrationNumber,
          // Met person
          metPersonName: nocData.metPersonName,
          metPersonDesignation: nocData.metPersonDesignation,
          metPersonRelation: nocData.metPersonRelation,
          metPersonContact: nocData.metPersonContact,
          // NOC Positive xlsx fields
          authorisedSignature: nocData.authorisedSignature,
          nameOnNoc: nocData.nameOnNoc,
          flatNo: nocData.flatNo,
          // Document
          documentShownStatus: nocData.documentShownStatus,
          documentType: nocData.documentType,
          documentVerificationStatus: nocData.documentVerificationStatus,
          // TPC
          tpcMetPerson1: nocData.tpcMetPerson1,
          tpcName1: nocData.tpcName1,
          tpcConfirmation1: nocData.tpcConfirmation1,
          tpcMetPerson2: nocData.tpcMetPerson2,
          tpcName2: nocData.tpcName2,
          tpcConfirmation2: nocData.tpcConfirmation2,
          // Shifted/Contact
          shiftedPeriod: nocData.shiftedPeriod,
          currentLocation: nocData.currentLocation,
          premisesStatus: nocData.premisesStatus,
          entryRestrictionReason: nocData.entryRestrictionReason,
          securityPersonName: nocData.securityPersonName,
          securityConfirmation: nocData.securityConfirmation,
          contactPerson: nocData.contactPerson,
          callRemark: nocData.callRemark,
          // Clearances
          environmentalClearance: nocData.environmentalClearance,
          fireSafetyClearance: nocData.fireSafetyClearance,
          pollutionClearance: nocData.pollutionClearance,
          waterConnectionStatus: nocData.waterConnectionStatus,
          electricityConnectionStatus: nocData.electricityConnectionStatus,
          complianceIssues: nocData.complianceIssues,
          regulatoryConcerns: nocData.regulatoryConcerns,
          // Area assessment
          infrastructureStatus: nocData.infrastructureStatus,
          roadConnectivity: nocData.roadConnectivity,
          dominatedArea: nocData.dominatedArea,
          feedbackFromNeighbour: nocData.feedbackFromNeighbour,
          politicalConnection: nocData.politicalConnection,
          otherObservation: nocData.otherObservation,
          recommendationStatus: nocData.recommendationStatus,
          finalStatus: nocData.finalStatus,
        };
      }
    } else if (typeUpper.includes('DSA') || typeUpper.includes('CONNECTOR')) {
      const dsaQuery = `
        SELECT * FROM verification_reports
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const dsaResult = await dbQuery(dsaQuery, [verificationTaskId]);

      if (dsaResult.rows.length > 0) {
        const dsaData = dsaResult.rows[0];
        outcome = dsaData.verificationOutcome;

        // Map DSA/Connector verification data to form data structure
        formData = {
          customerName: dsaData.customerName,
          addressLocatable: dsaData.addressLocatable,
          addressRating: dsaData.addressRating,
          locality: dsaData.locality,
          addressStructure: dsaData.addressStructure,
          addressFloor: dsaData.addressFloor,
          addressStructureColor: dsaData.addressStructureColor,
          doorColor: dsaData.doorColor,
          landmark1: dsaData.landmark1,
          landmark2: dsaData.landmark2,
          landmark3: dsaData.landmark3,
          landmark4: dsaData.landmark4,
          // Connector details
          officeStatus: dsaData.officeStatus,
          connectorType: dsaData.connectorType,
          connectorCode: dsaData.connectorCode,
          connectorName: dsaData.connectorName,
          connectorDesignation: dsaData.connectorDesignation,
          connectorExperience: dsaData.connectorExperience,
          connectorStatus: dsaData.connectorStatus,
          // Business details
          businessName: dsaData.businessName,
          businessType: dsaData.businessType,
          businessRegistrationNumber: dsaData.businessRegistrationNumber,
          businessEstablishmentYear: dsaData.businessEstablishmentYear,
          businessExistence: dsaData.businessExistence,
          businessHours: dsaData.businessHours,
          weekendOperations: dsaData.weekendOperations,
          customerFootfall: dsaData.customerFootfall,
          // Office
          officeType: dsaData.officeType,
          officeArea: dsaData.officeArea,
          officeRent: dsaData.officeRent,
          // Staff
          totalStaff: dsaData.totalStaff,
          salesStaff: dsaData.salesStaff,
          supportStaff: dsaData.supportStaff,
          teamSize: dsaData.teamSize,
          // Financial
          monthlyBusinessVolume: dsaData.monthlyBusinessVolume,
          averageMonthlySales: dsaData.averageMonthlySales,
          annualTurnover: dsaData.annualTurnover,
          monthlyIncome: dsaData.monthlyIncome,
          commissionStructure: dsaData.commissionStructure,
          paymentTerms: dsaData.paymentTerms,
          bankAccountDetails: dsaData.bankAccountDetails,
          // Technology
          computerSystems: dsaData.computerSystems,
          internetConnection: dsaData.internetConnection,
          softwareSystems: dsaData.softwareSystems,
          posTerminals: dsaData.posTerminals,
          printerScanner: dsaData.printerScanner,
          // Compliance
          licenseStatus: dsaData.licenseStatus,
          licenseNumber: dsaData.licenseNumber,
          licenseExpiryDate: dsaData.licenseExpiryDate,
          complianceStatus: dsaData.complianceStatus,
          auditStatus: dsaData.auditStatus,
          trainingStatus: dsaData.trainingStatus,
          // Met person
          metPersonName: dsaData.metPersonName,
          metPersonDesignation: dsaData.metPersonDesignation,
          metPersonRelation: dsaData.metPersonRelation,
          metPersonContact: dsaData.metPersonContact,
          // TPC
          tpcMetPerson1: dsaData.tpcMetPerson1,
          tpcName1: dsaData.tpcName1,
          tpcConfirmation1: dsaData.tpcConfirmation1,
          tpcMetPerson2: dsaData.tpcMetPerson2,
          tpcName2: dsaData.tpcName2,
          tpcConfirmation2: dsaData.tpcConfirmation2,
          // DSA Positive xlsx fields
          ownershipType: dsaData.ownershipType,
          nameOfCompanyOwners: dsaData.nameOfCompanyOwners,
          addressStatus: dsaData.addressStatus,
          companyNatureOfBusiness: dsaData.companyNatureOfBusiness,
          businessPeriod: dsaData.businessPeriod,
          activeClient: dsaData.activeClient,
          companyNamePlateStatus: dsaData.companyNamePlateStatus,
          nameOnBoard: dsaData.nameOnBoard,
          staffSeen: dsaData.staffSeen,
          // Shifted
          shiftedPeriod: dsaData.shiftedPeriod,
          oldOfficeShiftedPeriod: dsaData.shiftedPeriod,
          currentLocation: dsaData.currentLocation,
          premisesStatus: dsaData.premisesStatus,
          previousBusinessName: dsaData.previousBusinessName,
          currentCompanyName: dsaData.currentCompanyName,
          currentCompanyPeriod: dsaData.currentCompanyPeriod,
          // NSP
          applicantExistance: dsaData.applicantExistence,
          // ERT
          metPersonType: dsaData.metPersonDesignation,
          businessExistStatus: dsaData.businessExistStatus,
          applicantStayingFloor: dsaData.applicantStayingFloor,
          // Entry restricted
          entryRestrictionReason: dsaData.entryRestrictionReason,
          securityPersonName: dsaData.securityPersonName,
          securityConfirmation: dsaData.securityConfirmation,
          // Untraceable
          contactPerson: dsaData.contactPerson,
          callRemark: dsaData.callRemark,
          // Market
          marketPresence: dsaData.marketPresence,
          competitorAnalysis: dsaData.competitorAnalysis,
          marketReputation: dsaData.marketReputation,
          customerFeedback: dsaData.customerFeedback,
          commercialViability: dsaData.commercialViability,
          // Area assessment
          dominatedArea: dsaData.dominatedArea,
          feedbackFromNeighbour: dsaData.feedbackFromNeighbour,
          politicalConnection: dsaData.politicalConnection,
          infrastructureStatus: dsaData.infrastructureStatus,
          otherObservation: dsaData.otherObservation,
          businessConcerns: dsaData.businessConcerns,
          operationalChallenges: dsaData.operationalChallenges,
          growthPotential: dsaData.growthPotential,
          riskAssessment: dsaData.riskAssessment,
          recommendationStatus: dsaData.recommendationStatus,
          finalStatus: dsaData.finalStatus,
        };
      }
    } else if (typeUpper.includes('PROPERTY') && typeUpper.includes('APF')) {
      const propertyApfQuery = `
        SELECT * FROM verification_reports
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const propertyApfResult = await dbQuery(propertyApfQuery, [verificationTaskId]);

      if (propertyApfResult.rows.length > 0) {
        const propertyData = propertyApfResult.rows[0];
        outcome = propertyData.verificationOutcome;

        // Map Property APF verification data to form data structure
        formData = {
          customerName: propertyData.customerName,
          addressLocatable: propertyData.addressLocatable,
          addressRating: propertyData.addressRating,
          locality: propertyData.locality,
          addressStructure: propertyData.addressStructure,
          addressFloor: propertyData.addressFloor,
          addressStructureColor: propertyData.addressStructureColor,
          doorColor: propertyData.doorColor,
          landmark1: propertyData.landmark1,
          landmark2: propertyData.landmark2,
          landmark3: propertyData.landmark3,
          landmark4: propertyData.landmark4,
          // Property details
          propertyType: propertyData.propertyType,
          propertyStatus: propertyData.propertyStatus,
          propertyOwnership: propertyData.propertyOwnership,
          propertyAge: propertyData.propertyAge,
          propertyCondition: propertyData.propertyCondition,
          propertyArea: propertyData.propertyArea,
          propertyValue: propertyData.propertyValue,
          marketValue: propertyData.marketValue,
          buildingStatus: propertyData.buildingStatus,
          constructionActivity: propertyData.constructionActivity,
          // APF details
          apfStatus: propertyData.apfStatus,
          apfNumber: propertyData.apfNumber,
          apfIssueDate: propertyData.apfIssueDate,
          apfExpiryDate: propertyData.apfExpiryDate,
          apfIssuingAuthority: propertyData.apfIssuingAuthority,
          apfValidityStatus: propertyData.apfValidityStatus,
          apfAmount: propertyData.apfAmount,
          apfUtilizedAmount: propertyData.apfUtilizedAmount,
          apfBalanceAmount: propertyData.apfBalanceAmount,
          // Project details
          projectName: propertyData.projectName,
          projectStatus: propertyData.projectStatus,
          projectApprovalStatus: propertyData.projectApprovalStatus,
          projectCompletionPercentage: propertyData.projectCompletionPercentage,
          totalUnits: propertyData.totalUnits,
          completedUnits: propertyData.completedUnits,
          soldUnits: propertyData.soldUnits,
          availableUnits: propertyData.availableUnits,
          possessionStatus: propertyData.possessionStatus,
          staffStrength: propertyData.staffStrength,
          staffSeen: propertyData.staffSeen,
          // Project details
          projectStartedDate: propertyData.projectStartedDate,
          projectCompletionDate: propertyData.projectCompletionDate,
          totalWing: propertyData.totalWing,
          totalFlats: propertyData.totalFlats,
          totalBuildingsInProject: propertyData.totalBuildingsInProject,
          totalFlatsInBuilding: propertyData.totalFlatsInBuilding,
          activityStopReason: propertyData.activityStopReason,
          companyNamePlateStatus: propertyData.companyNamePlateStatus,
          nameOnBoard: propertyData.nameOnBoard,
          // Builder
          builderName: propertyData.builderName,
          builderContact: propertyData.builderContact,
          developerName: propertyData.developerName,
          developerContact: propertyData.developerContact,
          builderRegistrationNumber: propertyData.builderRegistrationNumber,
          reraRegistrationNumber: propertyData.reraRegistrationNumber,
          // Financial
          loanAmount: propertyData.loanAmount,
          loanPurpose: propertyData.loanPurpose,
          loanStatus: propertyData.loanStatus,
          bankName: propertyData.bankName,
          emiAmount: propertyData.emiAmount,
          loanAccountNumber: propertyData.loanAccountNumber,
          // Met person
          metPersonName: propertyData.metPersonName,
          metPersonDesignation: propertyData.metPersonDesignation,
          metPersonType: propertyData.metPersonDesignation,
          metPersonRelation: propertyData.metPersonRelation,
          metPersonContact: propertyData.metPersonContact,
          // 2026-04-27: Property APF `designation` column dropped (Path A unification);
          // canonical key is metPersonDesignation above.
          nameOfMetPerson: propertyData.metPersonName,
          metPersonConfirmation: propertyData.metPersonConfirmation,
          // Document
          documentShownStatus: propertyData.documentShownStatus,
          documentType: propertyData.documentType,
          documentVerificationStatus: propertyData.documentVerificationStatus,
          // TPC
          tpcMetPerson1: propertyData.tpcMetPerson1,
          tpcName1: propertyData.tpcName1,
          tpcConfirmation1: propertyData.tpcConfirmation1,
          tpcMetPerson2: propertyData.tpcMetPerson2,
          tpcName2: propertyData.tpcName2,
          tpcConfirmation2: propertyData.tpcConfirmation2,
          // Legal
          legalClearance: propertyData.legalClearance,
          titleClearance: propertyData.titleClearance,
          encumbranceStatus: propertyData.encumbranceStatus,
          litigationStatus: propertyData.litigationStatus,
          // Shifted/Contact
          shiftedPeriod: propertyData.shiftedPeriod,
          currentLocation: propertyData.currentLocation,
          premisesStatus: propertyData.premisesStatus,
          entryRestrictionReason: propertyData.entryRestrictionReason,
          securityPersonName: propertyData.securityPersonName,
          securityConfirmation: propertyData.securityConfirmation,
          contactPerson: propertyData.contactPerson,
          callRemark: propertyData.callRemark,
          // Area assessment
          dominatedArea: propertyData.dominatedArea,
          feedbackFromNeighbour: propertyData.feedbackFromNeighbour,
          politicalConnection: propertyData.politicalConnection,
          infrastructureStatus: propertyData.infrastructureStatus,
          roadConnectivity: propertyData.roadConnectivity,
          otherObservation: propertyData.otherObservation,
          propertyConcerns: propertyData.propertyConcerns,
          financialConcerns: propertyData.financialConcerns,
          recommendationStatus: propertyData.recommendationStatus,
          finalStatus: propertyData.finalStatus,
        };
      }
    } else if (typeUpper.includes('PROPERTY') && typeUpper.includes('INDIVIDUAL')) {
      const propertyIndividualQuery = `
        SELECT * FROM verification_reports
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const propertyIndividualResult = await dbQuery(propertyIndividualQuery, [verificationTaskId]);

      if (propertyIndividualResult.rows.length > 0) {
        const propertyData = propertyIndividualResult.rows[0];
        outcome = propertyData.verificationOutcome;

        // Map Property Individual verification data to form data structure
        formData = {
          customerName: propertyData.customerName,
          addressLocatable: propertyData.addressLocatable,
          addressRating: propertyData.addressRating,
          propertyStatus: propertyData.propertyStatus,
          propertyType: propertyData.propertyType,
          // Property Individual xlsx fields
          buildingStatus: propertyData.propertyStatus,
          flatStatus: propertyData.premisesStatus,
          propertyOwnerName: propertyData.ownerName,
          relationship: propertyData.metPersonRelation,
          addressExistAt: propertyData.addressExistAt,
          doorNamePlateStatus: propertyData.doorNamePlate,
          nameOnDoorPlate: propertyData.nameOnDoorPlate,
          societyNamePlateStatus: propertyData.societyNamePlate,
          nameOnSocietyBoard: propertyData.nameOnSocietyBoard,
          metPersonType: propertyData.metPersonDesignation,
          locality: propertyData.locality,
          addressStructure: propertyData.addressStructure,
          addressFloor: propertyData.addressFloor,
          addressStructureColor: propertyData.addressStructureColor,
          doorColor: propertyData.doorColor,
          // Property details
          ownershipStatus: propertyData.propertyOwnership,
          propertyAge: propertyData.propertyAge,
          approxArea: propertyData.propertyArea,
          propertyCondition: propertyData.propertyCondition,
          propertyValue: propertyData.propertyValue,
          marketValue: propertyData.marketValue,
          constructionType: propertyData.constructionType,
          constructionYear: propertyData.constructionYear,
          renovationYear: propertyData.renovationYear,
          propertyAmenities: propertyData.propertyAmenities,
          propertyLocation: propertyData.propertyLocation,
          propertyDescription: propertyData.propertyDescription,
          propertyConcerns: propertyData.propertyConcerns,
          propertyDocuments: propertyData.propertyDocuments,
          // Owner details
          ownerName: propertyData.ownerName,
          ownerRelation: propertyData.ownerRelation,
          ownerAge: propertyData.ownerAge,
          ownerOccupation: propertyData.ownerOccupation,
          ownerIncome: propertyData.ownerIncome,
          yearsOfResidence: propertyData.yearsOfResidence,
          familyMembers: propertyData.familyMembers,
          earningMembers: propertyData.earningMembers,
          previousOwnerName: propertyData.previousOwnerName,
          // Individual details
          individualName: propertyData.individualName,
          individualAge: propertyData.individualAge,
          individualOccupation: propertyData.individualOccupation,
          individualIncome: propertyData.individualIncome,
          individualEducation: propertyData.individualEducation,
          individualMaritalStatus: propertyData.individualMaritalStatus,
          individualExperience: propertyData.individualExperience,
          // Employment
          employmentType: propertyData.employmentType,
          employerName: propertyData.employerName,
          employmentDuration: propertyData.employmentDuration,
          monthlyIncome: propertyData.monthlyIncome,
          annualIncome: propertyData.annualIncome,
          incomeSource: propertyData.incomeSource,
          // Business
          businessName: propertyData.businessName,
          businessType: propertyData.businessType,
          businessExperience: propertyData.businessExperience,
          businessIncome: propertyData.businessIncome,
          // Met person
          metPersonName: propertyData.metPersonName,
          metPersonDesignation: propertyData.metPersonDesignation,
          metPersonRelation: propertyData.metPersonRelation,
          metPersonContact: propertyData.metPersonContact,
          // Neighbors
          neighbor1Name: propertyData.neighbor1Name,
          neighbor1Confirmation: propertyData.neighbor1Confirmation,
          neighbor2Name: propertyData.neighbor2Name,
          neighbor2Confirmation: propertyData.neighbor2Confirmation,
          localityReputation: propertyData.localityReputation,
          // TPC
          tpcMetPerson1: propertyData.tpcMetPerson1,
          tpcName1: propertyData.tpcName1,
          tpcConfirmation1: propertyData.tpcConfirmation1,
          tpcMetPerson2: propertyData.tpcMetPerson2,
          tpcName2: propertyData.tpcName2,
          tpcConfirmation2: propertyData.tpcConfirmation2,
          // Landmarks
          landmark1: propertyData.landmark1,
          landmark2: propertyData.landmark2,
          landmark3: propertyData.landmark3,
          landmark4: propertyData.landmark4,
          // Document & Legal
          documentVerificationStatus: propertyData.documentVerificationStatus,
          titleClearStatus: propertyData.titleClearStatus,
          mutationStatus: propertyData.mutationStatus,
          taxPaymentStatus: propertyData.taxPaymentStatus,
          legalIssues: propertyData.legalIssues,
          loanAgainstProperty: propertyData.loanAgainstProperty,
          bankName: propertyData.bankName,
          loanAmount: propertyData.loanAmount,
          emiAmount: propertyData.emiAmount,
          // Utilities
          electricityConnection: propertyData.electricityConnection,
          waterConnection: propertyData.waterConnection,
          gasConnection: propertyData.gasConnection,
          internetConnection: propertyData.internetConnection,
          roadConnectivity: propertyData.roadConnectivity,
          publicTransport: propertyData.publicTransport,
          safetySecurity: propertyData.safetySecurity,
          infrastructureStatus: propertyData.infrastructureStatus,
          // Shifted/Contact
          shiftedPeriod: propertyData.shiftedPeriod,
          currentLocation: propertyData.currentLocation,
          premisesStatus: propertyData.premisesStatus,
          // Entry restricted
          entryRestrictionReason: propertyData.entryRestrictionReason,
          securityPersonName: propertyData.securityPersonName,
          securityConfirmation: propertyData.securityConfirmation,
          // Untraceable
          contactPerson: propertyData.contactPerson,
          callRemark: propertyData.callRemark,
          // Area assessment
          dominatedArea: propertyData.dominatedArea,
          feedbackFromNeighbour: propertyData.feedbackFromNeighbour,
          politicalConnection: propertyData.politicalConnection,
          otherObservation: propertyData.otherObservation,
          verificationChallenges: propertyData.verificationChallenges,
          recommendationStatus: propertyData.recommendationStatus,
          finalStatus: propertyData.finalStatus,
        };
      }
    } else {
      // Fallback for unknown verification types
      formData =
        caseData.verificationData?.formData || caseData.verificationData?.verification || {};
      logger.warn(`Unknown verification type ${verificationType}, using fallback data`);
    }

    // CRITICAL FIX: Normalize verification type for template service
    // Database stores "Business Verification", but templates expect "BUSINESS"
    const normalizedVerificationType = normalizeVerificationType(verificationType);
    logger.info('Normalized verification type for template generation', {
      original: verificationType,
      normalized: normalizedVerificationType,
    });

    // Prepare data for template generation
    const reportData = {
      verificationType: normalizedVerificationType,
      outcome,
      formData,
      caseDetails: {
        caseId: caseData.id,
        customerName: caseData.customerName,
        address,
      },
    };

    // Generate template-based report
    const result = templateReportService.generateTemplateReport(reportData);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // F7.11.2: dual-write report content to object storage and DB.
    // Legacy report_content TEXT column kept until S3 cutover.
    const saveQuery = `
      INSERT INTO template_reports (
        case_id, submission_id, verification_type, outcome,
        report_content, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, created_at
    `;

    const saveResult = await dbQuery(saveQuery, [
      caseData.id,
      submissionId,
      verificationType,
      outcome,
      result.report,
      JSON.stringify(result.metadata),
    ]);

    const reportId = saveResult.rows[0].id;

    // F7.11.2: write the rendered report to object storage + record storage_key.
    // After production S3 cutover, drop report_content TEXT column and read
    // exclusively via storage.get(storage_key).
    try {
      const storageKey = StorageKeys.templateReport(caseData.id, submissionId, reportId);
      await storage.put(
        storageKey,
        Buffer.from(result.report || '', 'utf8'),
        'text/html; charset=utf-8'
      );
      await dbQuery(`UPDATE template_reports SET storage_key = $1 WHERE id = $2`, [
        storageKey,
        reportId,
      ]);
    } catch (storageErr) {
      // Storage failure is non-fatal during dual-write window; report_content TEXT
      // is still persisted in DB. Logged for ops follow-up.
      logger.warn('template_reports storage.put failed (dual-write fallback to DB only)', {
        reportId,
        error: String(storageErr),
      });
    }

    logger.info('Template report generated and saved successfully', {
      caseId,
      submissionId,
      reportId,
      userId,
    });

    res.json({
      success: true,
      reportId,
      report: result.report,
      metadata: result.metadata,
    });
  } catch (error) {
    logger.error('Error generating template report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get existing template report for a form submission
 */
export async function getTemplateReport(req: Request, res: Response) {
  try {
    const caseId = String(req.params.caseId || '');
    const submissionId = String(req.params.submissionId || '');

    logger.info('Retrieving template report', {
      caseId,
      submissionId,
    });

    // Get case UUID — handle both UUID and integer caseId
    const isUuidLookup = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      caseId
    );
    const caseQuery = isUuidLookup
      ? `SELECT id FROM cases WHERE id = $1`
      : `SELECT id FROM cases WHERE case_id = $1`;
    const caseResult = await dbQuery(caseQuery, [isUuidLookup ? caseId : parseInt(caseId)]);

    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseUuid = caseResult.rows[0].id;

    // Get template report using mobile app submission ID
    const reportQuery = `
      SELECT id, report_content, metadata, created_at, created_by
      FROM template_reports
      WHERE case_id = $1 AND submission_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const reportResult = await dbQuery(reportQuery, [caseUuid, submissionId]);

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template report not found' });
    }

    const report = reportResult.rows[0];

    res.json({
      success: true,
      report: {
        id: report.id,
        content: report.report_content,
        metadata: report.metadata,
        createdAt: report.created_at,
        createdBy: report.created_by,
      },
    });
  } catch (error) {
    logger.error('Error retrieving template report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get all template reports for a case
 */
export async function getCaseTemplateReports(req: Request, res: Response) {
  try {
    const caseId = String(req.params.caseId || '');

    logger.info('Retrieving all template reports for case', { caseId });

    // Get case UUID — handle both UUID and integer caseId
    const isUuidLookup = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      caseId
    );
    const caseQuery = isUuidLookup
      ? `SELECT id FROM cases WHERE id = $1`
      : `SELECT id FROM cases WHERE case_id = $1`;
    const caseResult = await dbQuery(caseQuery, [isUuidLookup ? caseId : parseInt(caseId)]);

    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseUuid = caseResult.rows[0].id;

    // Get all template reports for the case
    const reportsQuery = `
      SELECT id, submission_id, verification_type, outcome, 
             report_content, metadata, created_at, created_by
      FROM template_reports 
      WHERE case_id = $1
      ORDER BY created_at DESC
    `;

    const reportsResult = await dbQuery(reportsQuery, [caseUuid]);

    const reports = reportsResult.rows.map(report => ({
      id: report.id,
      submissionId: report.submission_id,
      verificationType: report.verification_type,
      outcome: report.outcome,
      content: report.report_content,
      metadata: report.metadata,
      createdAt: report.created_at,
      createdBy: report.created_by,
    }));

    res.json({
      success: true,
      reports,
    });
  } catch (error) {
    logger.error('Error retrieving case template reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Delete a template report
 */
export async function deleteTemplateReport(req: AuthenticatedRequest, res: Response) {
  try {
    const reportId = String(req.params.reportId || '');
    const userId = req.user!.id;

    logger.info('Deleting template report', { reportId, userId });

    const deleteQuery = `
      DELETE FROM template_reports 
      WHERE id = $1 AND created_by = $2
      RETURNING id
    `;

    const result = await dbQuery(deleteQuery, [reportId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template report not found or unauthorized' });
    }

    logger.info('Template report deleted successfully', { reportId, userId });

    res.json({ success: true, message: 'Template report deleted successfully' });
  } catch (error) {
    logger.error('Error deleting template report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
