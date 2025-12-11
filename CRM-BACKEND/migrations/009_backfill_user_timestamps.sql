-- Backfill createdAt and updatedAt for users table
UPDATE users
SET
    "createdAt" = COALESCE(
        "createdAt",
        CURRENT_TIMESTAMP
    ),
    "updatedAt" = COALESCE(
        "updatedAt",
        CURRENT_TIMESTAMP
    )
WHERE
    "createdAt" IS NULL
    OR "updatedAt" IS NULL;