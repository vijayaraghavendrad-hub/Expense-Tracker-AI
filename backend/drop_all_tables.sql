-- Run this SQL in your database dashboard SQL Editor
-- This will drop ALL data and tables from your database

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Drop tables in dependency order
DROP TABLE IF EXISTS ml_predictions CASCADE;
DROP TABLE IF EXISTS recurring_expenses CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop any sequences that may have been created
DROP SEQUENCE IF EXISTS users_id_seq CASCADE;
DROP SEQUENCE IF EXISTS categories_id_seq CASCADE;
DROP SEQUENCE IF EXISTS transactions_id_seq CASCADE;
DROP SEQUENCE IF EXISTS budgets_id_seq CASCADE;
DROP SEQUENCE IF EXISTS recurring_expenses_id_seq CASCADE;
DROP SEQUENCE IF EXISTS ml_predictions_id_seq CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Verify all tables are gone
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
