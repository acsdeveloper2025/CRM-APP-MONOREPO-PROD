BEGIN;

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  product_id INTEGER NULL REFERENCES products(id) ON DELETE SET NULL,
  client_name VARCHAR(200) NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  billing_period_from TIMESTAMPTZ NULL,
  billing_period_to TIMESTAMPTZ NULL,
  issue_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_date TIMESTAMPTZ NOT NULL,
  approved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NULL,
  sent_at TIMESTAMPTZ NULL,
  paid_date TIMESTAMPTZ NULL,
  payment_method VARCHAR(50) NULL,
  transaction_id VARCHAR(100) NULL,
  notes TEXT NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  product_id INTEGER NULL REFERENCES products(id) ON DELETE SET NULL,
  verification_type_id INTEGER NULL REFERENCES "verificationTypes"(id) ON DELETE SET NULL,
  rate_type_id INTEGER NULL REFERENCES "rateTypes"(id) ON DELETE SET NULL,
  description VARCHAR(500) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_item_tasks (
  id BIGSERIAL PRIMARY KEY,
  invoice_item_id BIGINT NOT NULL REFERENCES invoice_items(id) ON DELETE CASCADE,
  verification_task_id UUID NOT NULL REFERENCES verification_tasks(id) ON DELETE RESTRICT,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE RESTRICT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  billed_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (verification_task_id)
);

CREATE TABLE IF NOT EXISTS invoice_status_history (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  from_status VARCHAR(50) NULL,
  to_status VARCHAR(50) NOT NULL,
  changed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_client_status_date
  ON invoices (client_id, status, issue_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_product_status
  ON invoices (product_id, status);

CREATE INDEX IF NOT EXISTS idx_invoices_due_date
  ON invoices (due_date);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id
  ON invoice_items (invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_client_id
  ON invoice_items (client_id);

CREATE INDEX IF NOT EXISTS idx_invoice_item_tasks_invoice_item_id
  ON invoice_item_tasks (invoice_item_id);

CREATE INDEX IF NOT EXISTS idx_invoice_item_tasks_case_id
  ON invoice_item_tasks (case_id);

CREATE INDEX IF NOT EXISTS idx_invoice_item_tasks_client_id
  ON invoice_item_tasks (client_id);

CREATE INDEX IF NOT EXISTS idx_invoice_status_history_invoice_id
  ON invoice_status_history (invoice_id, changed_at DESC);

COMMIT;
