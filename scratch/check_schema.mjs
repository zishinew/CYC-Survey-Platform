import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) process.env[k] = envConfig[k];

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function check() {
  const { data, error } = await supabase.from('answers').insert({session_id: '123e4567-e89b-12d3-a456-426614174000', question_id: '123e4567-e89b-12d3-a456-426614174001', answer_text: 'test'}).select();
  console.log(error ? error.message : "Success");
}
check();
