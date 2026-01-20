-- Add category_type column to bug_categories
ALTER TABLE bug_categories 
ADD COLUMN category_type text NOT NULL DEFAULT 'bug';

-- Add check constraint for valid types
ALTER TABLE bug_categories 
ADD CONSTRAINT valid_category_type 
CHECK (category_type IN ('bug', 'passed_locally', 'manual_fix'));

-- Insert default passed_locally reasons
INSERT INTO bug_categories (name, category_type, sort_order, is_active) VALUES
  ('Timing issue', 'passed_locally', 1, true),
  ('Environment mismatch', 'passed_locally', 2, true),
  ('Test data issue', 'passed_locally', 3, true),
  ('Flaky test behavior', 'passed_locally', 4, true),
  ('Network/API timing', 'passed_locally', 5, true);

-- Insert default manual_fix types (excluding Other which exists as bug type)
INSERT INTO bug_categories (name, category_type, sort_order, is_active) VALUES
  ('Test fix', 'manual_fix', 1, true),
  ('Config change', 'manual_fix', 2, true),
  ('Test data update', 'manual_fix', 3, true),
  ('Test refactor', 'manual_fix', 4, true),
  ('Environment fix', 'manual_fix', 5, true),
  ('testim.io issue', 'manual_fix', 6, true);