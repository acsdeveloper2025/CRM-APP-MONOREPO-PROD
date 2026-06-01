// usersController is now a thin re-export BARREL. Every handler lives in its
// own module under ./users/* (the §7 god-controller decomposition, 2026-06-01).
// routes/users.ts imports the same symbol names from this file, so the public
// surface is unchanged — the implementations just moved into focused modules.
//
// Shared helpers/consts (WHERE-builders, sort maps, USER_EXPORT_ROW_LIMIT,
// PRIMARY_RBAC_ROLE_NAME_SQL) live in ./users/queryBuilder.

// Core CRUD (list / by-id / create / update / delete / activate / deactivate /
// search / stats) + hierarchy-validation helpers.
export {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  searchUsers,
  getUserStats,
} from './users/crud';

// Lookups (departments / designations / role-permissions).
export { getDepartments, getDesignations, getRolePermissions } from './users/lookups';

// User-activities (list / stats / export).
export {
  getUserActivities,
  getUserActivitiesStats,
  exportUserActivities,
} from './users/activities';

// User-sessions (list / stats / export).
export { getUserSessions, getUserSessionsStats, exportUserSessions } from './users/sessions';

// Client/product-assignments (get / assign / remove).
export {
  getUserClientAssignments,
  assignClientsToUser,
  removeClientAssignment,
  getUserProductAssignments,
  assignProductsToUser,
  removeProductAssignment,
} from './users/assignments';

// Password-management (generate-temp / change / reset).
export { generateTemporaryPassword, changePassword, resetPassword } from './users/passwords';

// Field-agent pickers (available / assignable-by-role).
export { getAvailableFieldAgents, getAssignableUsersByRole } from './users/fieldAgents';

// Import/export (export / bulk-import / template).
export { exportUsers, bulkImportUsers, downloadUserTemplate } from './users/importExport';
