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
          // Shifted-specific
          shiftedPeriod: residenceData.shifted_period,
          currentLocation: residenceData.current_location,
          premisesStatus: residenceData.premises_status,
          stayingPersonName: residenceData.staying_person_name,
          roomStatus: residenceData.room_status,
          // ERT-specific
          nameOfMetPerson: residenceData.name_of_met_person,
          metPersonType: residenceData.met_person_type,
          metPersonConfirmation: residenceData.met_person_confirmation,
          applicantStayingStatus: residenceData.applicant_staying_status,
          // Untraceable-specific
          contactPerson: residenceData.contact_person,
          callRemark: residenceData.call_remark,
          // Extra landmarks
          landmark3: residenceData.landmark3,
          landmark4: residenceData.landmark4,
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
          addressLocatable: businessData.address_locatable,
          addressRating: businessData.address_rating,
          locality: businessData.locality,
          addressStructure: businessData.address_structure,
          addressFloor: businessData.address_floor,
          addressStructureColor: businessData.address_structure_color,
          doorColor: businessData.door_color,
          landmark1: businessData.landmark1,
          landmark2: businessData.landmark2,
          landmark3: businessData.landmark3,
          landmark4: businessData.landmark4,
          // Business details
          businessStatus: businessData.business_status,
          businessType: businessData.business_type,
          businessName: businessData.business_name,
          ownershipType: businessData.ownership_type,
          companyNatureOfBusiness: businessData.company_nature_of_business,
          businessPeriod: businessData.business_period,
          establishmentPeriod: businessData.establishment_period,
          businessApproxArea: businessData.business_approx_area,
          staffStrength: businessData.staff_strength,
          staffSeen: businessData.staff_seen,
          // Person details
          metPersonName: businessData.met_person_name,
          designation: businessData.designation,
          applicantDesignation: businessData.applicant_designation,
          workingPeriod: businessData.working_period,
          workingStatus: businessData.working_status,
          applicantWorkingPremises: businessData.applicant_working_premises,
          ownerName: businessData.owner_name,
          businessOwnerName: businessData.business_owner_name,
          nameOfCompanyOwners: businessData.name_of_company_owners,
          // Nameplate
          companyNamePlateStatus: businessData.company_nameplate_status,
          nameOnBoard: businessData.name_on_company_board,
          // Document
          documentShown: businessData.document_shown,
          documentType: businessData.document_type,
          // TPC
          tpcMetPerson1: businessData.tpc_met_person1,
          nameOfTpc1: businessData.tpc_name1,
          tpcConfirmation1: businessData.tpc_confirmation1,
          tpcMetPerson2: businessData.tpc_met_person2,
          nameOfTpc2: businessData.tpc_name2,
          tpcConfirmation2: businessData.tpc_confirmation2,
          // Shifted
          shiftedPeriod: businessData.shifted_period,
          oldBusinessShiftedPeriod: businessData.old_business_shifted_period,
          currentCompanyName: businessData.current_company_name,
          currentCompanyPeriod: businessData.current_company_period,
          premisesStatus: businessData.premises_status,
          // Entry restricted
          nameOfMetPerson: businessData.name_of_met_person,
          metPersonType: businessData.met_person_type,
          metPersonConfirmation: businessData.met_person_confirmation,
          applicantWorkingStatus: businessData.applicant_working_status,
          // Untraceable
          contactPerson: businessData.contact_person,
          callRemark: businessData.call_remark,
          // Area assessment
          dominatedArea: businessData.dominated_area,
          feedbackFromNeighbour: businessData.feedback_from_neighbour,
          politicalConnection: businessData.political_connection,
          otherObservation: businessData.other_observation,
          otherExtraRemark: businessData.other_extra_remark,
          holdReason: businessData.hold_reason,
          recommendationStatus: businessData.recommendation_status,
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
          addressLocatable: builderData.address_locatable,
          addressRating: builderData.address_rating,
          locality: builderData.locality,
          addressStructure: builderData.address_structure,
          addressFloor: builderData.address_floor,
          addressStructureColor: builderData.address_structure_color,
          doorColor: builderData.door_color,
          landmark1: builderData.landmark1,
          landmark2: builderData.landmark2,
          landmark3: builderData.landmark3,
          landmark4: builderData.landmark4,
          // Builder details
          officeStatus: builderData.office_status,
          officeExistence: builderData.office_existence,
          builderType: builderData.builder_type,
          builderName: builderData.builder_name,
          builderOwnerName: builderData.builder_owner_name,
          companyNatureOfBusiness: builderData.company_nature_of_business,
          businessPeriod: builderData.business_period,
          establishmentPeriod: builderData.establishment_period,
          officeApproxArea: builderData.office_approx_area,
          staffStrength: builderData.staff_strength,
          staffSeen: builderData.staff_seen,
          // Person details
          metPersonName: builderData.met_person_name,
          designation: builderData.designation,
          applicantDesignation: builderData.applicant_designation,
          workingPeriod: builderData.working_period,
          workingStatus: builderData.working_status,
          // Nameplate
          companyNamePlateStatus: builderData.company_nameplate_status,
          nameOnBoard: builderData.name_on_company_board,
          // Document
          documentShown: builderData.document_shown,
          // TPC
          tpcMetPerson1: builderData.tpc_met_person1,
          nameOfTpc1: builderData.tpc_name1,
          tpcConfirmation1: builderData.tpc_confirmation1,
          tpcMetPerson2: builderData.tpc_met_person2,
          nameOfTpc2: builderData.tpc_name2,
          tpcConfirmation2: builderData.tpc_confirmation2,
          // Entry restricted
          nameOfMetPerson: builderData.name_of_met_person,
          metPersonType: builderData.met_person_type,
          metPersonConfirmation: builderData.met_person_confirmation,
          applicantWorkingStatus: builderData.applicant_working_status,
          // Shifted
          shiftedPeriod: builderData.shifted_period,
          oldOfficeShiftedPeriod: builderData.old_office_shifted_period,
          currentCompanyName: builderData.current_company_name,
          currentCompanyPeriod: builderData.current_company_period,
          premisesStatus: builderData.premises_status,
          // Untraceable
          contactPerson: builderData.contact_person,
          callRemark: builderData.call_remark,
          // Area assessment
          dominatedArea: builderData.dominated_area,
          feedbackFromNeighbour: builderData.feedback_from_neighbour,
          politicalConnection: builderData.political_connection,
          otherObservation: builderData.other_observation,
          otherExtraRemark: builderData.other_extra_remark,
          holdReason: builderData.hold_reason,
          recommendationStatus: builderData.recommendation_status,
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
          locality: nocData.locality,
          addressStructure: nocData.address_structure,
          addressFloor: nocData.address_floor,
          addressStructureColor: nocData.address_structure_color,
          doorColor: nocData.door_color,
          landmark1: nocData.landmark1,
          landmark2: nocData.landmark2,
          landmark3: nocData.landmark3,
          landmark4: nocData.landmark4,
          // NOC details
          officeStatus: nocData.office_status,
          nocStatus: nocData.noc_status,
          nocType: nocData.noc_type,
          nocNumber: nocData.noc_number,
          nocIssueDate: nocData.noc_issue_date,
          nocExpiryDate: nocData.noc_expiry_date,
          nocIssuingAuthority: nocData.noc_issuing_authority,
          nocValidityStatus: nocData.noc_validity_status,
          // Property/Project
          propertyType: nocData.property_type,
          projectName: nocData.project_name,
          projectStatus: nocData.project_status,
          constructionStatus: nocData.construction_status,
          projectApprovalStatus: nocData.project_approval_status,
          totalUnits: nocData.total_units,
          completedUnits: nocData.completed_units,
          soldUnits: nocData.sold_units,
          possessionStatus: nocData.possession_status,
          // Builder/Developer
          builderName: nocData.builder_name,
          builderContact: nocData.builder_contact,
          developerName: nocData.developer_name,
          developerContact: nocData.developer_contact,
          builderRegistrationNumber: nocData.builder_registration_number,
          // Met person
          metPersonName: nocData.met_person_name,
          metPersonDesignation: nocData.met_person_designation,
          metPersonRelation: nocData.met_person_relation,
          metPersonContact: nocData.met_person_contact,
          // Document
          documentShownStatus: nocData.document_shown_status,
          documentType: nocData.document_type,
          documentVerificationStatus: nocData.document_verification_status,
          // TPC
          tpcMetPerson1: nocData.tpc_met_person1,
          nameOfTpc1: nocData.tpc_name1,
          tpcConfirmation1: nocData.tpc_confirmation1,
          tpcMetPerson2: nocData.tpc_met_person2,
          nameOfTpc2: nocData.tpc_name2,
          tpcConfirmation2: nocData.tpc_confirmation2,
          // Shifted/Contact
          shiftedPeriod: nocData.shifted_period,
          currentLocation: nocData.current_location,
          premisesStatus: nocData.premises_status,
          entryRestrictionReason: nocData.entry_restriction_reason,
          securityPersonName: nocData.security_person_name,
          securityConfirmation: nocData.security_confirmation,
          contactPerson: nocData.contact_person,
          callRemark: nocData.call_remark,
          // Clearances
          environmentalClearance: nocData.environmental_clearance,
          fireSafetyClearance: nocData.fire_safety_clearance,
          pollutionClearance: nocData.pollution_clearance,
          waterConnectionStatus: nocData.water_connection_status,
          electricityConnectionStatus: nocData.electricity_connection_status,
          complianceIssues: nocData.compliance_issues,
          regulatoryConcerns: nocData.regulatory_concerns,
          // Area assessment
          infrastructureStatus: nocData.infrastructure_status,
          roadConnectivity: nocData.road_connectivity,
          dominatedArea: nocData.dominated_area,
          feedbackFromNeighbour: nocData.feedback_from_neighbour,
          politicalConnection: nocData.political_connection,
          otherObservation: nocData.other_observation,
          holdReason: nocData.hold_reason,
          recommendationStatus: nocData.recommendation_status,
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
          addressLocatable: dsaData.address_locatable,
          addressRating: dsaData.address_rating,
          locality: dsaData.locality,
          addressStructure: dsaData.address_structure,
          addressFloor: dsaData.address_floor,
          addressStructureColor: dsaData.address_structure_color,
          doorColor: dsaData.door_color,
          landmark1: dsaData.landmark1,
          landmark2: dsaData.landmark2,
          landmark3: dsaData.landmark3,
          landmark4: dsaData.landmark4,
          // Connector details
          officeStatus: dsaData.office_status,
          connectorType: dsaData.connector_type,
          connectorCode: dsaData.connector_code,
          connectorName: dsaData.connector_name,
          connectorDesignation: dsaData.connector_designation,
          connectorExperience: dsaData.connector_experience,
          connectorStatus: dsaData.connector_status,
          // Business details
          businessName: dsaData.business_name,
          businessType: dsaData.business_type,
          businessRegistrationNumber: dsaData.business_registration_number,
          businessEstablishmentYear: dsaData.business_establishment_year,
          businessOperational: dsaData.business_operational,
          businessHours: dsaData.business_hours,
          weekendOperations: dsaData.weekend_operations,
          customerFootfall: dsaData.customer_footfall,
          // Office
          officeType: dsaData.office_type,
          officeArea: dsaData.office_area,
          officeRent: dsaData.office_rent,
          // Staff
          totalStaff: dsaData.total_staff,
          salesStaff: dsaData.sales_staff,
          supportStaff: dsaData.support_staff,
          teamSize: dsaData.team_size,
          // Financial
          monthlyBusinessVolume: dsaData.monthly_business_volume,
          averageMonthlySales: dsaData.average_monthly_sales,
          annualTurnover: dsaData.annual_turnover,
          monthlyIncome: dsaData.monthly_income,
          commissionStructure: dsaData.commission_structure,
          paymentTerms: dsaData.payment_terms,
          bankAccountDetails: dsaData.bank_account_details,
          // Technology
          computerSystems: dsaData.computer_systems,
          internetConnection: dsaData.internet_connection,
          softwareSystems: dsaData.software_systems,
          posTerminals: dsaData.pos_terminals,
          printerScanner: dsaData.printer_scanner,
          // Compliance
          licenseStatus: dsaData.license_status,
          licenseNumber: dsaData.license_number,
          licenseExpiryDate: dsaData.license_expiry_date,
          complianceStatus: dsaData.compliance_status,
          auditStatus: dsaData.audit_status,
          trainingStatus: dsaData.training_status,
          // Met person
          metPersonName: dsaData.met_person_name,
          metPersonDesignation: dsaData.met_person_designation,
          metPersonRelation: dsaData.met_person_relation,
          metPersonContact: dsaData.met_person_contact,
          // TPC
          tpcMetPerson1: dsaData.tpc_met_person1,
          nameOfTpc1: dsaData.tpc_name1,
          tpcConfirmation1: dsaData.tpc_confirmation1,
          tpcMetPerson2: dsaData.tpc_met_person2,
          nameOfTpc2: dsaData.tpc_name2,
          tpcConfirmation2: dsaData.tpc_confirmation2,
          // Shifted
          shiftedPeriod: dsaData.shifted_period,
          currentLocation: dsaData.current_location,
          premisesStatus: dsaData.premises_status,
          previousBusinessName: dsaData.previous_business_name,
          // Entry restricted
          entryRestrictionReason: dsaData.entry_restriction_reason,
          securityPersonName: dsaData.security_person_name,
          securityConfirmation: dsaData.security_confirmation,
          // Untraceable
          contactPerson: dsaData.contact_person,
          callRemark: dsaData.call_remark,
          // Market
          marketPresence: dsaData.market_presence,
          competitorAnalysis: dsaData.competitor_analysis,
          marketReputation: dsaData.market_reputation,
          customerFeedback: dsaData.customer_feedback,
          commercialViability: dsaData.commercial_viability,
          // Area assessment
          dominatedArea: dsaData.dominated_area,
          feedbackFromNeighbour: dsaData.feedback_from_neighbour,
          politicalConnection: dsaData.political_connection,
          infrastructureStatus: dsaData.infrastructure_status,
          otherObservation: dsaData.other_observation,
          businessConcerns: dsaData.business_concerns,
          operationalChallenges: dsaData.operational_challenges,
          growthPotential: dsaData.growth_potential,
          riskAssessment: dsaData.risk_assessment,
          holdReason: dsaData.hold_reason,
          recommendationStatus: dsaData.recommendation_status,
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
          locality: propertyData.locality,
          addressStructure: propertyData.address_structure,
          addressFloor: propertyData.address_floor,
          addressStructureColor: propertyData.address_structure_color,
          doorColor: propertyData.door_color,
          landmark1: propertyData.landmark1,
          landmark2: propertyData.landmark2,
          landmark3: propertyData.landmark3,
          landmark4: propertyData.landmark4,
          // Property details
          propertyType: propertyData.property_type,
          propertyStatus: propertyData.property_status,
          propertyOwnership: propertyData.property_ownership,
          propertyAge: propertyData.property_age,
          propertyCondition: propertyData.property_condition,
          propertyArea: propertyData.property_area,
          propertyValue: propertyData.property_value,
          marketValue: propertyData.market_value,
          buildingStatus: propertyData.building_status,
          constructionActivity: propertyData.construction_activity,
          // APF details
          apfStatus: propertyData.apf_status,
          apfNumber: propertyData.apf_number,
          apfIssueDate: propertyData.apf_issue_date,
          apfExpiryDate: propertyData.apf_expiry_date,
          apfIssuingAuthority: propertyData.apf_issuing_authority,
          apfValidityStatus: propertyData.apf_validity_status,
          apfAmount: propertyData.apf_amount,
          apfUtilizedAmount: propertyData.apf_utilized_amount,
          apfBalanceAmount: propertyData.apf_balance_amount,
          // Project details
          projectName: propertyData.project_name,
          projectStatus: propertyData.project_status,
          projectApprovalStatus: propertyData.project_approval_status,
          projectCompletionPercentage: propertyData.project_completion_percentage,
          totalUnits: propertyData.total_units,
          completedUnits: propertyData.completed_units,
          soldUnits: propertyData.sold_units,
          availableUnits: propertyData.available_units,
          possessionStatus: propertyData.possession_status,
          staffStrength: propertyData.staff_strength,
          staffSeen: propertyData.staff_seen,
          // Builder
          builderName: propertyData.builder_name,
          builderContact: propertyData.builder_contact,
          developerName: propertyData.developer_name,
          developerContact: propertyData.developer_contact,
          builderRegistrationNumber: propertyData.builder_registration_number,
          reraRegistrationNumber: propertyData.rera_registration_number,
          // Financial
          loanAmount: propertyData.loan_amount,
          loanPurpose: propertyData.loan_purpose,
          loanStatus: propertyData.loan_status,
          bankName: propertyData.bank_name,
          emiAmount: propertyData.emi_amount,
          // Met person
          metPersonName: propertyData.met_person_name,
          metPersonDesignation: propertyData.met_person_designation,
          metPersonRelation: propertyData.met_person_relation,
          metPersonContact: propertyData.met_person_contact,
          // Document
          documentShownStatus: propertyData.document_shown_status,
          documentType: propertyData.document_type,
          // TPC
          tpcMetPerson1: propertyData.tpc_met_person1,
          nameOfTpc1: propertyData.tpc_name1,
          tpcConfirmation1: propertyData.tpc_confirmation1,
          tpcMetPerson2: propertyData.tpc_met_person2,
          nameOfTpc2: propertyData.tpc_name2,
          tpcConfirmation2: propertyData.tpc_confirmation2,
          // Legal
          legalClearance: propertyData.legal_clearance,
          titleClearance: propertyData.title_clearance,
          encumbranceStatus: propertyData.encumbrance_status,
          litigationStatus: propertyData.litigation_status,
          // Shifted/Contact
          shiftedPeriod: propertyData.shifted_period,
          currentLocation: propertyData.current_location,
          premisesStatus: propertyData.premises_status,
          entryRestrictionReason: propertyData.entry_restriction_reason,
          securityPersonName: propertyData.security_person_name,
          securityConfirmation: propertyData.security_confirmation,
          contactPerson: propertyData.contact_person,
          callRemark: propertyData.call_remark,
          // Area assessment
          dominatedArea: propertyData.dominated_area,
          feedbackFromNeighbour: propertyData.feedback_from_neighbour,
          politicalConnection: propertyData.political_connection,
          infrastructureStatus: propertyData.infrastructure_status,
          roadConnectivity: propertyData.road_connectivity,
          otherObservation: propertyData.other_observation,
          propertyConcerns: propertyData.property_concerns,
          financialConcerns: propertyData.financial_concerns,
          holdReason: propertyData.hold_reason,
          recommendationStatus: propertyData.recommendation_status,
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
          ownershipStatus: propertyData.property_ownership,
          propertyAge: propertyData.property_age,
          approxArea: propertyData.property_area,
          locality: propertyData.locality,
          addressStructure: propertyData.address_structure,
          addressFloor: propertyData.address_floor,
          addressStructureColor: propertyData.address_structure_color,
          doorColor: propertyData.door_color,
          // TPC
          tpcMetPerson1: propertyData.tpc_met_person1,
          nameOfTpc1: propertyData.tpc_name1,
          tpcConfirmation1: propertyData.tpc_confirmation1,
          tpcMetPerson2: propertyData.tpc_met_person2,
          nameOfTpc2: propertyData.tpc_name2,
          tpcConfirmation2: propertyData.tpc_confirmation2,
          // Landmarks
          landmark1: propertyData.landmark1,
          landmark2: propertyData.landmark2,
          landmark3: propertyData.landmark3,
          landmark4: propertyData.landmark4,
          // Shifted/Contact
          shiftedPeriod: propertyData.shifted_period,
          currentLocation: propertyData.current_location,
          premisesStatus: propertyData.premises_status,
          // Entry restricted
          entryRestrictionReason: propertyData.entry_restriction_reason,
          securityPersonName: propertyData.security_person_name,
          securityConfirmation: propertyData.security_confirmation,
          // Untraceable
          contactPerson: propertyData.contact_person,
          callRemark: propertyData.call_remark,
          // Area assessment
          dominatedArea: propertyData.dominated_area,
          feedbackFromNeighbour: propertyData.feedback_from_neighbour,
          politicalConnection: propertyData.political_connection,
          otherObservation: propertyData.other_observation,
          holdReason: propertyData.hold_reason,
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
