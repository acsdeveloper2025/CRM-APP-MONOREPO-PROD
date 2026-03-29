import type { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { templateReportService } from '../services/TemplateReportService';
import { pool } from '../config/database';
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
    const userId = req.user?.id;

    logger.info('Generating template report for form submission', {
      caseId,
      submissionId,
      userId,
    });

    // Get case details
    const caseQuery = `
      SELECT id, "customerName", "verificationData", "verificationType", "verificationOutcome", status
      FROM cases
      WHERE "caseId" = $1
    `;
    const caseResult = await pool.query(caseQuery, [parseInt(caseId)]);

    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = caseResult.rows[0];

    // FIXED: Find the verification task ID using the submissionId from verification_attachments
    const taskQuery = `
      SELECT DISTINCT vt.id as task_id, vt.verification_type_id, vtype.name as verification_type_name
      FROM verification_tasks vt
      LEFT JOIN "verificationTypes" vtype ON vt.verification_type_id = vtype.id
      LEFT JOIN verification_attachments va ON va.verification_task_id = vt.id
      WHERE vt.case_id = $1 AND va."submissionId" = $2
      LIMIT 1
    `;
    const taskResult = await pool.query(taskQuery, [caseData.id, submissionId]);

    if (taskResult.rows.length === 0) {
      logger.error('Verification task not found for submission', { caseId, submissionId });
      return res.status(404).json({ error: 'Verification task not found for this submission' });
    }

    const taskData = taskResult.rows[0];
    const verificationTaskId = taskData.task_id;
    const verificationType = taskData.verification_type_name || caseData.verificationType;

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
        SELECT * FROM "residenceVerificationReports"
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const residenceResult = await pool.query(residenceQuery, [verificationTaskId]);

      if (residenceResult.rows.length > 0) {
        const residenceData = residenceResult.rows[0];
        outcome = residenceData.verification_outcome;

        // Map residence verification data to form data structure
        formData = {
          customerName: residenceData.customer_name,
          addressLocatable: residenceData.address_locatable,
          addressRating: residenceData.address_rating,
          houseStatus: residenceData.house_status,
          metPersonName: residenceData.met_person_name,
          metPersonRelation: residenceData.met_person_relation,
          metPersonStatus: residenceData.met_person_status,
          stayingPeriod: residenceData.staying_period,
          stayingStatus: residenceData.staying_status,
          totalFamilyMembers: residenceData.total_family_members,
          totalEarningMember: residenceData.total_earning_member,
          workingStatus: residenceData.working_status,
          companyName: residenceData.company_name,
          approxArea: residenceData.approx_area,
          doorNamePlateStatus: residenceData.door_nameplate_status,
          nameOnDoorPlate: residenceData.name_on_door_plate,
          societyNamePlateStatus: residenceData.society_nameplate_status,
          nameOnSocietyBoard: residenceData.name_on_society_board,
          locality: residenceData.locality,
          addressStructure: residenceData.address_structure,
          applicantStayingFloor: residenceData.applicant_staying_floor,
          addressFloor: residenceData.address_floor,
          addressStructureColor: residenceData.address_structure_color,
          doorColor: residenceData.door_color,
          documentType: residenceData.document_type,
          tpcMetPerson1: residenceData.tpc_met_person1,
          nameOfTpc1: residenceData.tpc_name1,
          tpcConfirmation1: residenceData.tpc_confirmation1,
          tpcMetPerson2: residenceData.tpc_met_person2,
          nameOfTpc2: residenceData.tpc_name2,
          tpcConfirmation2: residenceData.tpc_confirmation2,
          landmark1: residenceData.landmark1,
          landmark2: residenceData.landmark2,
          dominatedArea: residenceData.dominated_area,
          feedbackFromNeighbour: residenceData.feedback_from_neighbour,
          politicalConnection: residenceData.political_connection,
          otherObservation: residenceData.other_observation,
          finalStatus: residenceData.final_status,
          shiftedPeriod: residenceData.shifted_period,
          premisesStatus: residenceData.premises_status,
        };
      }
    } else if (typeUpper.includes('OFFICE') && !typeUpper.includes('RESIDENCE')) {
      const officeQuery = `
        SELECT * FROM "officeVerificationReports"
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const officeResult = await pool.query(officeQuery, [verificationTaskId]);

      if (officeResult.rows.length > 0) {
        const officeData = officeResult.rows[0];
        outcome = officeData.verification_outcome;

        // Map office verification data to form data structure
        formData = {
          customerName: officeData.customer_name,
          addressLocatable: officeData.address_locatable,
          addressRating: officeData.address_rating,
          officeStatus: officeData.office_status,
          metPersonName: officeData.met_person_name,
          designation: officeData.designation,
          workingPeriod: officeData.working_period,
          applicantDesignation: officeData.applicant_designation,
          applicantWorkingPremises: officeData.applicant_working_premises,
          sittingLocation: officeData.sitting_location,
          officeType: officeData.office_type,
          companyNatureOfBusiness: officeData.company_nature_of_business,
          staffStrength: officeData.staff_strength,
          staffSeen: officeData.staff_seen,
          officeApproxArea: officeData.office_approx_area,
          companyNamePlateStatus: officeData.company_nameplate_status,
          nameOnBoard: officeData.name_on_company_board,
          locality: officeData.locality,
          addressStructure: officeData.address_structure,
          addressStructureColor: officeData.address_structure_color,
          doorColor: officeData.door_color,
          tpcMetPerson1: officeData.tpc_met_person1,
          nameOfTpc1: officeData.tpc_name1,
          tpcConfirmation1: officeData.tpc_confirmation1,
          tpcMetPerson2: officeData.tpc_met_person2,
          nameOfTpc2: officeData.tpc_name2,
          tpcConfirmation2: officeData.tpc_confirmation2,
          landmark1: officeData.landmark1,
          landmark2: officeData.landmark2,
          dominatedArea: officeData.dominated_area,
          feedbackFromNeighbour: officeData.feedback_from_neighbour,
          politicalConnection: officeData.political_connection,
          otherObservation: officeData.other_observation,
          finalStatus: officeData.final_status,

          // ERT-specific fields
          metPersonType: officeData.met_person_type,
          nameOfMetPerson: officeData.name_of_met_person,
          metPersonConfirmation: officeData.met_person_confirmation,
          officeExistFloor: officeData.address_floor,

          // SHIFTED-specific fields
          oldOfficeShiftedPeriod: officeData.old_office_shifted_period,
          currentCompanyName: officeData.current_company_name,
          currentCompanyPeriod: officeData.current_company_period,

          // UNTRACEABLE-specific fields
          callRemark: officeData.call_remark,
          landmark3: officeData.landmark3,
          landmark4: officeData.landmark4,

          // NSP-specific fields
          thirdPartyConfirmation: officeData.third_party_confirmation,
          officeExistence: officeData.office_existence,
        };
      }
    } else if (typeUpper.includes('BUSINESS')) {
      const businessQuery = `
        SELECT * FROM "businessVerificationReports"
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const businessResult = await pool.query(businessQuery, [verificationTaskId]);

      if (businessResult.rows.length > 0) {
        const businessData = businessResult.rows[0];
        outcome = businessData.verification_outcome;

        // Map business verification data to form data structure
        formData = {
          customerName: businessData.customer_name,
          businessType: businessData.business_type,
          businessName: businessData.business_name,
          addressLocatable: businessData.address_locatable,
          addressRating: businessData.address_rating,
          businessStatus: businessData.business_status,
          metPersonName: businessData.met_person_name,
          metPersonDesignation: businessData.met_person_designation,
          metPersonStatus: businessData.met_person_status,
          businessPeriod: businessData.business_period,
          businessActivity: businessData.business_activity,
          totalEmployees: businessData.total_employees,
          approxArea: businessData.approx_area,
          businessBoardStatus: businessData.business_board_status,
          nameOnBusinessBoard: businessData.name_on_business_board,
          locality: businessData.locality,
          addressStructure: businessData.address_structure,
          addressFloor: businessData.address_floor,
          addressStructureColor: businessData.address_structure_color,
          doorColor: businessData.door_color,
          tpcMetPerson1: businessData.tpc_met_person1,
          nameOfTpc1: businessData.tpc_name1,
          tpcConfirmation1: businessData.tpc_confirmation1,
          tpcMetPerson2: businessData.tpc_met_person2,
          nameOfTpc2: businessData.tpc_name2,
          tpcConfirmation2: businessData.tpc_confirmation2,
          landmark1: businessData.landmark1,
          landmark2: businessData.landmark2,
          dominatedArea: businessData.dominated_area,
          feedbackFromNeighbour: businessData.feedback_from_neighbour,
          politicalConnection: businessData.political_connection,
          otherObservation: businessData.other_observation,
          finalStatus: businessData.final_status,
        };
      }
    } else if (typeUpper.includes('RESIDENCE') && typeUpper.includes('OFFICE')) {
      const residenceCumOfficeQuery = `
        SELECT * FROM "residenceCumOfficeVerificationReports"
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const residenceCumOfficeResult = await pool.query(residenceCumOfficeQuery, [
        verificationTaskId,
      ]);

      if (residenceCumOfficeResult.rows.length > 0) {
        const rcData = residenceCumOfficeResult.rows[0];
        outcome = rcData.verification_outcome;

        // Map residence cum office verification data to form data structure
        formData = {
          customerName: rcData.customer_name,
          addressLocatable: rcData.address_locatable,
          addressRating: rcData.address_rating,
          houseStatus: rcData.house_status,
          officeStatus: rcData.office_status,
          metPersonName: rcData.met_person_name,
          metPersonRelation: rcData.met_person_relation,
          metPersonStatus: rcData.met_person_status,
          stayingPeriod: rcData.staying_period,
          stayingStatus: rcData.staying_status,
          stayingPersonName: rcData.staying_person_name,
          totalFamilyMembers: rcData.total_family_members,
          totalEarningMember: rcData.total_earning_member,
          workingStatus: rcData.working_status,
          workingPeriod: rcData.working_period,
          companyName: rcData.company_name,
          approxArea: rcData.approx_area,
          // Office fields
          officeType: rcData.office_type,
          designation: rcData.designation,
          applicantDesignation: rcData.applicant_designation,
          companyNatureOfBusiness: rcData.company_nature_of_business,
          businessPeriod: rcData.business_period,
          establishmentPeriod: rcData.establishment_period,
          staffStrength: rcData.staff_strength,
          staffSeen: rcData.staff_seen,
          applicantWorkingPremises: rcData.applicant_working_premises,
          sittingLocation: rcData.sitting_location,
          currentCompanyName: rcData.current_company_name,
          currentCompanyPeriod: rcData.current_company_period,
          // Nameplates
          doorNamePlateStatus: rcData.door_nameplate_status,
          nameOnDoorPlate: rcData.name_on_door_plate,
          societyNamePlateStatus: rcData.society_nameplate_status,
          nameOnSocietyBoard: rcData.name_on_society_board,
          companyNamePlateStatus: rcData.company_nameplate_status,
          nameOnBoard: rcData.name_on_company_board,
          // Location
          locality: rcData.locality,
          addressStructure: rcData.address_structure,
          addressFloor: rcData.address_floor,
          addressStructureColor: rcData.address_structure_color,
          doorColor: rcData.door_color,
          // Document
          documentShownStatus: rcData.document_shown_status,
          documentType: rcData.document_type,
          // TPC
          tpcMetPerson1: rcData.tpc_met_person1,
          nameOfTpc1: rcData.tpc_name1,
          tpcConfirmation1: rcData.tpc_confirmation1,
          tpcMetPerson2: rcData.tpc_met_person2,
          nameOfTpc2: rcData.tpc_name2,
          tpcConfirmation2: rcData.tpc_confirmation2,
          // Entry restricted
          nameOfMetPerson: rcData.name_of_met_person,
          metPersonType: rcData.met_person_type,
          metPersonConfirmation: rcData.met_person_confirmation,
          applicantStayingStatus: rcData.applicant_staying_status,
          applicantWorkingStatus: rcData.applicant_working_status,
          // Shifted
          shiftedPeriod: rcData.shifted_period,
          oldOfficeShiftedPeriod: rcData.old_office_shifted_period,
          premisesStatus: rcData.premises_status,
          // Untraceable
          contactPerson: rcData.contact_person,
          callRemark: rcData.call_remark,
          // Landmarks
          landmark1: rcData.landmark1,
          landmark2: rcData.landmark2,
          landmark3: rcData.landmark3,
          landmark4: rcData.landmark4,
          // Area assessment
          dominatedArea: rcData.dominated_area,
          feedbackFromNeighbour: rcData.feedback_from_neighbour,
          politicalConnection: rcData.political_connection,
          otherObservation: rcData.other_observation,
          otherExtraRemark: rcData.other_extra_remark,
          holdReason: rcData.hold_reason,
          recommendationStatus: rcData.recommendation_status,
          finalStatus: rcData.final_status,
        };
      }
    } else if (typeUpper.includes('BUILDER')) {
      const builderQuery = `
        SELECT * FROM "builderVerificationReports"
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const builderResult = await pool.query(builderQuery, [verificationTaskId]);

      if (builderResult.rows.length > 0) {
        const builderData = builderResult.rows[0];
        outcome = builderData.verification_outcome;

        // Map builder verification data to form data structure
        formData = {
          customerName: builderData.customer_name,
          builderName: builderData.builder_name,
          projectName: builderData.project_name,
          addressLocatable: builderData.address_locatable,
          addressRating: builderData.address_rating,
          projectStatus: builderData.project_status,
          metPersonName: builderData.met_person_name,
          metPersonDesignation: builderData.met_person_designation,
          metPersonStatus: builderData.met_person_status,
          projectStartDate: builderData.project_start_date,
          projectCompletionDate: builderData.project_completion_date,
          totalUnits: builderData.total_units,
          soldUnits: builderData.sold_units,
          approxArea: builderData.approx_area,
          projectBoardStatus: builderData.project_board_status,
          nameOnProjectBoard: builderData.name_on_project_board,
          locality: builderData.locality,
          addressStructure: builderData.address_structure,
          tpcMetPerson1: builderData.tpc_met_person1,
          nameOfTpc1: builderData.tpc_name1,
          tpcConfirmation1: builderData.tpc_confirmation1,
          tpcMetPerson2: builderData.tpc_met_person2,
          nameOfTpc2: builderData.tpc_name2,
          tpcConfirmation2: builderData.tpc_confirmation2,
          landmark1: builderData.landmark1,
          landmark2: builderData.landmark2,
          dominatedArea: builderData.dominated_area,
          feedbackFromNeighbour: builderData.feedback_from_neighbour,
          politicalConnection: builderData.political_connection,
          otherObservation: builderData.other_observation,
          finalStatus: builderData.final_status,
        };
      }
    } else if (typeUpper.includes('NOC')) {
      const nocQuery = `
        SELECT * FROM "nocVerificationReports"
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const nocResult = await pool.query(nocQuery, [verificationTaskId]);

      if (nocResult.rows.length > 0) {
        const nocData = nocResult.rows[0];
        outcome = nocData.verification_outcome;

        // Map NOC verification data to form data structure
        formData = {
          customerName: nocData.customer_name,
          addressLocatable: nocData.address_locatable,
          addressRating: nocData.address_rating,
          propertyStatus: nocData.property_status,
          metPersonName: nocData.met_person_name,
          metPersonRelation: nocData.met_person_relation,
          metPersonStatus: nocData.met_person_status,
          ownershipStatus: nocData.ownership_status,
          propertyType: nocData.property_type,
          approxArea: nocData.approx_area,
          locality: nocData.locality,
          addressStructure: nocData.address_structure,
          addressFloor: nocData.address_floor,
          tpcMetPerson1: nocData.tpc_met_person1,
          nameOfTpc1: nocData.tpc_name1,
          tpcConfirmation1: nocData.tpc_confirmation1,
          tpcMetPerson2: nocData.tpc_met_person2,
          nameOfTpc2: nocData.tpc_name2,
          tpcConfirmation2: nocData.tpc_confirmation2,
          landmark1: nocData.landmark1,
          landmark2: nocData.landmark2,
          dominatedArea: nocData.dominated_area,
          feedbackFromNeighbour: nocData.feedback_from_neighbour,
          politicalConnection: nocData.political_connection,
          otherObservation: nocData.other_observation,
          finalStatus: nocData.final_status,
        };
      }
    } else if (typeUpper.includes('DSA') || typeUpper.includes('CONNECTOR')) {
      const dsaQuery = `
        SELECT * FROM "dsaConnectorVerificationReports"
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const dsaResult = await pool.query(dsaQuery, [verificationTaskId]);

      if (dsaResult.rows.length > 0) {
        const dsaData = dsaResult.rows[0];
        outcome = dsaData.verification_outcome;

        // Map DSA/Connector verification data to form data structure
        formData = {
          customerName: dsaData.customer_name,
          dsaName: dsaData.dsa_name,
          addressLocatable: dsaData.address_locatable,
          addressRating: dsaData.address_rating,
          officeStatus: dsaData.office_status,
          metPersonName: dsaData.met_person_name,
          metPersonDesignation: dsaData.met_person_designation,
          metPersonStatus: dsaData.met_person_status,
          businessPeriod: dsaData.business_period,
          totalEmployees: dsaData.total_employees,
          approxArea: dsaData.approx_area,
          officeBoardStatus: dsaData.office_board_status,
          nameOnOfficeBoard: dsaData.name_on_office_board,
          locality: dsaData.locality,
          addressStructure: dsaData.address_structure,
          addressFloor: dsaData.address_floor,
          tpcMetPerson1: dsaData.tpc_met_person1,
          nameOfTpc1: dsaData.tpc_name1,
          tpcConfirmation1: dsaData.tpc_confirmation1,
          tpcMetPerson2: dsaData.tpc_met_person2,
          nameOfTpc2: dsaData.tpc_name2,
          tpcConfirmation2: dsaData.tpc_confirmation2,
          landmark1: dsaData.landmark1,
          landmark2: dsaData.landmark2,
          dominatedArea: dsaData.dominated_area,
          feedbackFromNeighbour: dsaData.feedback_from_neighbour,
          politicalConnection: dsaData.political_connection,
          otherObservation: dsaData.other_observation,
          finalStatus: dsaData.final_status,
        };
      }
    } else if (typeUpper.includes('PROPERTY') && typeUpper.includes('APF')) {
      const propertyApfQuery = `
        SELECT * FROM "propertyApfVerificationReports"
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const propertyApfResult = await pool.query(propertyApfQuery, [verificationTaskId]);

      if (propertyApfResult.rows.length > 0) {
        const propertyData = propertyApfResult.rows[0];
        outcome = propertyData.verification_outcome;

        // Map Property APF verification data to form data structure
        formData = {
          customerName: propertyData.customer_name,
          addressLocatable: propertyData.address_locatable,
          addressRating: propertyData.address_rating,
          propertyStatus: propertyData.property_status,
          propertyType: propertyData.property_type,
          metPersonName: propertyData.met_person_name,
          metPersonRelation: propertyData.met_person_relation,
          metPersonStatus: propertyData.met_person_status,
          ownershipStatus: propertyData.ownership_status,
          propertyAge: propertyData.property_age,
          approxArea: propertyData.approx_area,
          locality: propertyData.locality,
          addressStructure: propertyData.address_structure,
          addressFloor: propertyData.address_floor,
          tpcMetPerson1: propertyData.tpc_met_person1,
          nameOfTpc1: propertyData.tpc_name1,
          tpcConfirmation1: propertyData.tpc_confirmation1,
          tpcMetPerson2: propertyData.tpc_met_person2,
          nameOfTpc2: propertyData.tpc_name2,
          tpcConfirmation2: propertyData.tpc_confirmation2,
          landmark1: propertyData.landmark1,
          landmark2: propertyData.landmark2,
          dominatedArea: propertyData.dominated_area,
          feedbackFromNeighbour: propertyData.feedback_from_neighbour,
          politicalConnection: propertyData.political_connection,
          otherObservation: propertyData.other_observation,
          finalStatus: propertyData.final_status,
        };
      }
    } else if (typeUpper.includes('PROPERTY') && typeUpper.includes('INDIVIDUAL')) {
      const propertyIndividualQuery = `
        SELECT * FROM "propertyIndividualVerificationReports"
        WHERE verification_task_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const propertyIndividualResult = await pool.query(propertyIndividualQuery, [
        verificationTaskId,
      ]);

      if (propertyIndividualResult.rows.length > 0) {
        const propertyData = propertyIndividualResult.rows[0];
        outcome = propertyData.verification_outcome;

        // Map Property Individual verification data to form data structure
        formData = {
          customerName: propertyData.customer_name,
          addressLocatable: propertyData.address_locatable,
          addressRating: propertyData.address_rating,
          propertyStatus: propertyData.property_status,
          propertyType: propertyData.property_type,
          metPersonName: propertyData.met_person_name,
          metPersonRelation: propertyData.met_person_relation,
          metPersonStatus: propertyData.met_person_status,
          ownershipStatus: propertyData.ownership_status,
          propertyAge: propertyData.property_age,
          approxArea: propertyData.approx_area,
          locality: propertyData.locality,
          addressStructure: propertyData.address_structure,
          addressFloor: propertyData.address_floor,
          tpcMetPerson1: propertyData.tpc_met_person1,
          nameOfTpc1: propertyData.tpc_name1,
          tpcConfirmation1: propertyData.tpc_confirmation1,
          tpcMetPerson2: propertyData.tpc_met_person2,
          nameOfTpc2: propertyData.tpc_name2,
          tpcConfirmation2: propertyData.tpc_confirmation2,
          landmark1: propertyData.landmark1,
          landmark2: propertyData.landmark2,
          dominatedArea: propertyData.dominated_area,
          feedbackFromNeighbour: propertyData.feedback_from_neighbour,
          politicalConnection: propertyData.political_connection,
          otherObservation: propertyData.other_observation,
          finalStatus: propertyData.final_status,
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

    // Save report to database
    const saveQuery = `
      INSERT INTO template_reports (
        case_id, submission_id, verification_type, outcome,
        report_content, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, created_at
    `;

    const saveResult = await pool.query(saveQuery, [
      caseData.id,
      submissionId,
      verificationType,
      outcome,
      result.report,
      JSON.stringify(result.metadata),
    ]);

    const reportId = saveResult.rows[0].id;

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

    // Get case UUID
    const caseQuery = `SELECT id FROM cases WHERE "caseId" = $1`;
    const caseResult = await pool.query(caseQuery, [parseInt(caseId)]);

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

    const reportResult = await pool.query(reportQuery, [caseUuid, submissionId]);

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

    // Get case UUID
    const caseQuery = `SELECT id FROM cases WHERE "caseId" = $1`;
    const caseResult = await pool.query(caseQuery, [parseInt(caseId)]);

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

    const reportsResult = await pool.query(reportsQuery, [caseUuid]);

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
    const userId = req.user?.id;

    logger.info('Deleting template report', { reportId, userId });

    const deleteQuery = `
      DELETE FROM template_reports 
      WHERE id = $1 AND created_by = $2
      RETURNING id
    `;

    const result = await pool.query(deleteQuery, [reportId, userId]);

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
