import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually since dotenv doesn't do .env.local by default easily without config
const envPath = path.resolve('../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const NUM_RESPONSES = 50;

const fakeFirstNames = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy", "Mallory", "Niaj", "Olivia", "Peggy", "Sybil", "Trent", "Victor", "Walter"];
const fakeLastNames = ["Smith", "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin"];

const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const generateEmail = () => `${randomElement(fakeFirstNames).toLowerCase()}.${randomElement(fakeLastNames).toLowerCase()}${randomInt(1, 999)}@example.com`;

const fakeTextResponses = [
  "I think there should be more focus on mental health resources in schools.",
  "We need better public transportation options for youth.",
  "Affordable housing is my biggest concern right now.",
  "I strongly believe that climate change action should be prioritized.",
  "More community centers and safe spaces for teenagers would be great.",
  "Job opportunities for recent graduates are severely lacking.",
  "The current education curriculum feels outdated and needs a refresh.",
  "I wish there was more transparency in local government.",
  "Everything is fine as it is, no major complaints.",
  "Healthcare accessibility is a huge issue for me and my family."
];

async function generateData() {
  console.log("Fetching an active survey...");
  const { data: surveys, error: surveyError } = await supabase
    .from('surveys')
    .select('id, title')
    .eq('has_been_published', true)
    .limit(1);

  if (surveyError || !surveys || surveys.length === 0) {
    console.error("Could not find any published surveys.", surveyError);
    return;
  }

  const survey = surveys[0];
  console.log(`Generating ${NUM_RESPONSES} fake responses for Survey: "${survey.title}" (ID: ${survey.id})`);

  // Fetch questions
  const { data: questions, error: qError } = await supabase
    .from('questions')
    .select('*')
    .eq('survey_id', survey.id);

  if (qError || !questions || questions.length === 0) {
    console.error("Survey has no questions.", qError);
    return;
  }

  for (let i = 0; i < NUM_RESPONSES; i++) {
    const email = generateEmail();
    
    // Create Session
    const { data: sessionData, error: sessionError } = await supabase
      .from('response_sessions')
      .insert({
        survey_id: survey.id,
        email: email,
        is_completed: true,
        completed_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (sessionError) {
      console.error("Error creating session:", sessionError);
      continue;
    }

    const sessionId = sessionData.id;
    const answersToInsert = [];

    for (const q of questions) {
      if (q.type === 'section_header') continue;

      let answer_text = null;
      let answer_numeric = null;
      let answer_options = null;

      const opts = q.options || {};
      const choices = opts.choices || [];

      if (q.type === 'multiple_choice' || q.type === 'dropdown') {
        if (choices.length > 0) {
          answer_options = [randomElement(choices)];
        }
      } else if (q.type === 'checkboxes') {
        if (choices.length > 0) {
          const numSelections = randomInt(1, Math.min(3, choices.length));
          const shuffled = [...choices].sort(() => 0.5 - Math.random());
          answer_options = shuffled.slice(0, numSelections);
        }
      } else if (q.type === 'rating_scale' || q.type === 'likert_scale') {
        // Likert is usually 1-5
        answer_numeric = randomInt(1, 5);
      } else if (q.type === 'short_answer' || q.type === 'long_answer') {
        answer_text = randomElement(fakeTextResponses);
      } else if (q.type === 'linear_scale') {
        const min = opts.min || 1;
        const max = opts.max || 5;
        answer_numeric = randomInt(min, max);
      } else {
        answer_text = randomElement(fakeTextResponses); // Fallback
      }

      answersToInsert.push({
        session_id: sessionId,
        question_id: q.id,
        answer_text,
        answer_numeric,
        answer_options
      });
    }

    if (answersToInsert.length > 0) {
      const { error: insertError } = await supabase.from('answers').insert(answersToInsert);
      if (insertError) {
        console.error("Error inserting answers:", insertError);
      }
    }
  }

  console.log(`Successfully inserted ${NUM_RESPONSES} fake responses!`);
}

generateData().catch(console.error);
