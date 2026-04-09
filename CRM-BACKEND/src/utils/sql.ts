export const sql = {
  // common selects
  userByUsername: `SELECT id, name, username, email, password_hash as "passwordHash", role, employee_id as "employeeId", designation, department, profile_photo_url as "profilePhotoUrl" FROM users WHERE username = $1`,
};
