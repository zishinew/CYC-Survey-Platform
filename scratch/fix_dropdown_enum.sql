-- Run this in your Supabase SQL Editor to add the 'dropdown' option to the existing question_type ENUM
ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'dropdown';
