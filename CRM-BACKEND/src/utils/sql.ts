// 2026-04-28 F1.1.1: `userByUsername` removed.
// The `role` text column on `users` was dropped (RBAC via user_roles → roles_v2
// is the single source of truth). The query had zero consumers when audited;
// keeping the empty export so future code can add SQL fragments here.
export const sql = {};
