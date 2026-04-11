export const sql = {
  // common selects
  userByUsername: `SELECT id, name, username, email, password_hash as "password_hash", role, employee_id as "employee_id", designation, department, profile_photo_url as "profile_photo_url" FROM users WHERE username = $1`,
};
