#!/usr/bin/env python3
"""
Script to generate the changes needed for remaining verification methods.
This will output the line numbers and changes needed for each verification type.
"""

# Verification types to update (already done: RESIDENCE, OFFICE)
verification_types = [
    {"name": "Business", "type": "BUSINESS", "table": "businessVerificationReports", "start_line": 2528},
    {"name": "Builder", "type": "BUILDER", "table": "builderVerificationReports", "start_line": 2884},
    {"name": "ResidenceCumOffice", "type": "RESIDENCE_CUM_OFFICE", "table": "residenceCumOfficeVerificationReports", "start_line": 3221},
    {"name": "DsaConnector", "type": "DSA_CONNECTOR", "table": "dsaConnectorVerificationReports", "start_line": 3530},
    {"name": "PropertyIndividual", "type": "PROPERTY_INDIVIDUAL", "table": "propertyIndividualVerificationReports", "start_line": 3867},
    {"name": "PropertyApf", "type": "PROPERTY_APF", "table": "propertyApfVerificationReports", "start_line": 4204},
    {"name": "Noc", "type": "NOC", "table": "nocVerificationReports", "start_line": 4541},
]

print("=" * 80)
print("CHANGES NEEDED FOR REMAINING VERIFICATION METHODS")
print("=" * 80)

for vtype in verification_types:
    print(f"\n### {vtype['name']} Verification ({vtype['type']})")
    print(f"Starting around line {vtype['start_line']}")
    print()
    
    print("1. Update method signature to extract verificationTaskId:")
    print(f"   const {{ verificationTaskId, formData, geoLocation, photos, images }}: MobileFormSubmissionRequest = req.body;")
    print()
    
    print("2. Add verificationTaskId validation (after userId check):")
    print("""   if (!verificationTaskId) {
     return res.status(400).json({
       success: false,
       message: 'Verification task ID is required',
       error: { code: 'MISSING_TASK_ID', timestamp: new Date().toISOString() },
     });
   }""")
    print()
    
    print("3. Add task validation (after case validation):")
    print("""   const taskSql = `
     SELECT vt.*, vtype.name as verification_type_name, vtype.id as verification_type_id
     FROM verification_tasks vt
     LEFT JOIN "verificationTypes" vtype ON vt.verification_type_id = vtype.id
     WHERE vt.id = $1 AND vt.case_id = $2
   `;
   const taskRes = await query(taskSql, [verificationTaskId, actualCaseId]);
   const task = taskRes.rows[0];
   
   if (!task) {
     return res.status(404).json({
       success: false,
       message: 'Verification task not found or does not belong to this case',
       error: { code: 'TASK_NOT_FOUND', timestamp: new Date().toISOString(), verificationTaskId, caseId: actualCaseId },
     });
   }
   
   if (userRole === 'FIELD_AGENT' && task.assigned_to !== userId) {
     return res.status(403).json({
       success: false,
       message: 'This verification task is not assigned to you',
       error: { code: 'TASK_NOT_ASSIGNED', timestamp: new Date().toISOString(), verificationTaskId },
     });
   }
   
   console.log(`✅ Verification task validated: ${task.task_number} (Type: ${task.verification_type_name})`);""")
    print()
    
    print("4. Update processVerificationImages call to include verificationTaskId:")
    print(f"""   const uploadedImages = await MobileFormController.processVerificationImages(
     images || [],
     actualCaseId,
     '{vtype['type']}',
     submissionId,
     userId,
     verificationTaskId  // ✅ Add this parameter
   );""")
    print()
    
    print("5. Update task status before updating case:")
    print("""   await query(`
     UPDATE verification_tasks 
     SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
   `, [verificationTaskId]);""")
    print()
    
    print("6. Add verification_task_id to dbInsertData:")
    print(f"""   const dbInsertData = {{
     case_id: actualCaseId,
     verification_task_id: verificationTaskId,  // ✅ Add this line
     caseId: parseInt(updatedCase.caseId) || null,
     ...
   }};""")
    print()
    print("-" * 80)

print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"Total verification methods to update: {len(verification_types)}")
print("Pattern is consistent across all methods")
print("After updates, run: npm run build")
print("=" * 80)

