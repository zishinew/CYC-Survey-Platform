-- Run this in your Supabase SQL Editor
ALTER TABLE response_sessions ADD COLUMN IF NOT EXISTS attention_check_failures INTEGER DEFAULT 0;
ALTER TABLE response_sessions ADD COLUMN IF NOT EXISTS weight FLOAT DEFAULT 1.0;
ALTER TABLE response_sessions ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT true;
