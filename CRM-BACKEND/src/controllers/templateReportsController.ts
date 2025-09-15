import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { templateReportService } from '../services/TemplateReportService';
import { pool } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Template-based Reports Controller
 * Handles generation and management of template-based verification reports
 */

/**
 * Generate template-based report for a form submission
 */
export async function generateTemplateReport(req: AuthenticatedRequest, res: Response) {
  try {
    const { caseId, submissionId } = req.params;
    const userId = req.user?.id;

    logger.info('Generating template report for form submission', {
      caseId,
      submissionId,
      userId
    });

    // Get case details
    const caseQuery = `
      SELECT id, "customerName", "verificationData", "verificationType", "verificationOutcome", status, address
      FROM cases 
      WHERE "caseId" = $1
    `;
    const caseResult = await pool.query(caseQuery, [parseInt(caseId)]);
    
    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = caseResult.rows[0];
    const verificationType = caseData.verificationType;
    let outcome = caseData.verificationOutcome;
    let formData = caseData.verificationData?.formData || caseData.verificationData?.verification || {};

    // Get verification report data based on verification type
    if (verificationType === 'RESIDENCE') {
      const residenceQuery = `
        SELECT * FROM "residenceVerificationReports"
        WHERE "caseId" = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const residenceResult = await pool.query(residenceQuery, [parseInt(caseId)]);

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
          totalEarning: residenceData.total_earning,
          workingStatus: residenceData.working_status,
          companyName: residenceData.company_name,
          approxArea: residenceData.approx_area,
          doorNamePlateStatus: residenceData.door_nameplate_status,
          nameOnDoorPlate: residenceData.name_on_door_plate,
          societyNamePlateStatus: residenceData.society_nameplate_status,
          nameOnSocietyBoard: residenceData.name_on_society_board,
          localityType: residenceData.locality,
          addressStructure: residenceData.address_structure,
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
          premisesStatus: residenceData.premises_status
        };
      }
    } else if (verificationType === 'OFFICE') {
      const officeQuery = `
        SELECT * FROM "officeVerificationReports"
        WHERE "caseId" = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const officeResult = await pool.query(officeQuery, [parseInt(caseId)]);

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
          nameOnCompanyBoard: officeData.name_on_company_board,
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
          officeExistence: officeData.office_existence
        };
      }
    }

    // Prepare data for template generation
    const reportData = {
      verificationType,
      outcome,
      formData,
      caseDetails: {
        caseId: caseData.id,
        customerName: caseData.customerName,
        address: caseData.address
      }
    };

    // Generate template-based report
    const result = await templateReportService.generateTemplateReport(reportData);

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
      JSON.stringify(result.metadata)
    ]);

    const reportId = saveResult.rows[0].id;

    logger.info('Template report generated and saved successfully', {
      caseId,
      submissionId,
      reportId,
      userId
    });

    res.json({
      success: true,
      reportId,
      report: result.report,
      metadata: result.metadata
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
    const { caseId, submissionId } = req.params;

    logger.info('Retrieving template report', {
      caseId,
      submissionId
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
        createdBy: report.created_by
      }
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
    const { caseId } = req.params;

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
      createdBy: report.created_by
    }));

    res.json({
      success: true,
      reports
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
    const { reportId } = req.params;
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
