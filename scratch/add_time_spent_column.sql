-- Run this in your Supabase SQL Editor
ALTER TABLE answers ADD COLUMN IF NOT EXISTS time_spent INTEGER DEFAULT 0;
