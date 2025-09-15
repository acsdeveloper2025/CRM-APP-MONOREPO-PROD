export const sql = {
  // common selects
  userByUsername: `SELECT id, name, username, email, "passwordHash", role, "employeeId", designation, department, "profilePhotoUrl" FROM users WHERE username = $1`,
};

