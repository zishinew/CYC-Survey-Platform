from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any
from supabase import create_client, Client
import os
import uuid
import string
import random
from datetime import datetime
import io
import pdfplumber

# Initialize FastAPI
app = FastAPI(title="CYC Survey Platform API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from dotenv import load_dotenv
load_dotenv(dotenv_path=".env.local")

# Supabase Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
# Fallback to the secret key provided for backend operations
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Pydantic Models
class Question(BaseModel):
    id: str
    question_text: str
    type: str
    order_index: int
    options: Optional[Any] = None
    is_required: bool
    is_conditional: bool = False

class SurveyList(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    description_alignment: Optional[str] = "left"
    estimated_minutes: int
    is_active: bool
    has_been_published: bool = False
    thumbnail_url: Optional[str] = None
    response_count: Optional[int] = 0

class SurveyDetail(SurveyList):
    questions: List[Question]

class AnswerCreate(BaseModel):
    question_id: str
    answer_text: Optional[str] = None
    answer_numeric: Optional[int] = None
    answer_options: Optional[Any] = None
    time_spent: Optional[int] = 0

class ResponseSubmission(BaseModel):
    survey_id: str
    email: str
    answers: List[AnswerCreate]

# Routes

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file to Supabase Storage and return the public URL."""
    try:
        content = await file.read()
        ext = file.filename.split('.')[-1] if file.filename else 'bin'
        filename = f"{uuid.uuid4()}.{ext}"
        path = f"uploads/{filename}"

        supabase.storage.from_("survey-assets").upload(
            path,
            content,
            file_options={"content-type": file.content_type or "application/octet-stream"}
        )

        public_url = supabase.storage.from_("survey-assets").get_public_url(path)
        return {"url": public_url, "filename": file.filename}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/surveys", response_model=List[SurveyList])
async def get_surveys(include_inactive: bool = False):
    """Get surveys and their response counts"""
    try:
        query = supabase.table("surveys").select("*, response_sessions(count)")
        if not include_inactive:
            query = query.eq("is_active", True)
            
        response = query.execute()
        
        surveys = []
        for row in response.data:
            # Safely extract count from the joined response_sessions relation
            # PostgREST returns [{"count": X}] for relation counts
            count = 0
            if row.get("response_sessions"):
                try:
                    count = row["response_sessions"][0]["count"]
                except:
                    # Alternative format depending on supabase python client version
                    if isinstance(row["response_sessions"], list) and len(row["response_sessions"]) > 0:
                        count = len(row["response_sessions"])
                    else:
                        count = row["response_sessions"]
            
            row["response_count"] = count
            surveys.append(row)
            
        return surveys
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/surveys/{survey_id}", response_model=SurveyDetail)
async def get_survey(survey_id: str):
    """Get a specific survey with its questions"""
    try:
        # Fetch survey
        survey_res = supabase.table("surveys").select("*").eq("id", survey_id).execute()
        if not survey_res.data:
            raise HTTPException(status_code=404, detail="Survey not found")
        
        survey = survey_res.data[0]
        
        # Fetch questions
        questions_res = supabase.table("questions").select("*").eq("survey_id", survey_id).order("order_index").execute()
        
        survey["questions"] = questions_res.data
        return survey
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class QuestionCreate(BaseModel):
    question_text: str
    type: str
    order_index: int
    options: Optional[Any] = None
    is_required: bool
    is_conditional: bool = False

class SurveyCreate(BaseModel):
    title: str
    description: Optional[str] = None
    description_alignment: Optional[str] = "left"
    estimated_minutes: int = 5
    is_active: bool = True
    has_been_published: bool = False
    thumbnail_url: Optional[str] = None
    questions: List[QuestionCreate]

@app.post("/api/surveys", response_model=SurveyDetail)
async def create_survey(survey: SurveyCreate):
    """Create a new survey and its questions"""
    try:
        has_been_published = survey.is_active

        # 1. Create Survey
        survey_res = supabase.table("surveys").insert({
            "title": survey.title,
            "description": survey.description,
            "description_alignment": survey.description_alignment,
            "estimated_minutes": survey.estimated_minutes,
            "is_active": survey.is_active,
            "has_been_published": has_been_published,
            "thumbnail_url": survey.thumbnail_url
        }).execute()
        
        created_survey = survey_res.data[0]
        
        # 2. Create Questions
        if survey.questions:
            questions_to_insert = []
            for q in survey.questions:
                questions_to_insert.append({
                    "survey_id": created_survey["id"],
                    "question_text": q.question_text,
                    "type": q.type,
                    "order_index": q.order_index,
                    "options": q.options,
                    "is_required": q.is_required,
                    "is_conditional": q.is_conditional
                })
            
            questions_res = supabase.table("questions").insert(questions_to_insert).execute()
            created_survey["questions"] = questions_res.data
        else:
            created_survey["questions"] = []
            
        # 3. Append response_count to match SurveyDetail shape although it's 0 initially
        created_survey["response_count"] = 0
            
        return created_survey
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/surveys/{survey_id}/duplicate", response_model=SurveyDetail)
async def duplicate_survey(survey_id: str):
    """Duplicate an existing survey and its questions"""
    try:
        # 1. Fetch original survey
        survey_res = supabase.table("surveys").select("*").eq("id", survey_id).execute()
        if not survey_res.data:
            raise HTTPException(status_code=404, detail="Survey not found")
        
        original_survey = survey_res.data[0]
        
        # 2. Fetch original questions
        questions_res = supabase.table("questions").select("*").eq("survey_id", survey_id).order("order_index").execute()
        original_questions = questions_res.data
        
        # 3. Create new survey based on original
        new_survey_res = supabase.table("surveys").insert({
            "title": f"{original_survey['title']} (Copy)",
            "description": original_survey.get("description"),
            "description_alignment": original_survey.get("description_alignment", "left"),
            "estimated_minutes": original_survey.get("estimated_minutes", 5),
            "is_active": False,  # Duplicate should be inactive by default
            "has_been_published": False, # Duplicate hasn't been published
            "thumbnail_url": original_survey.get("thumbnail_url")
        }).execute()
        
        new_survey = new_survey_res.data[0]
        
        # 4. Duplicate questions
        if original_questions:
            questions_to_insert = []
            for q in original_questions:
                questions_to_insert.append({
                    "survey_id": new_survey["id"],
                    "question_text": q["question_text"],
                    "type": q["type"],
                    "order_index": q["order_index"],
                    "options": q["options"],
                    "is_required": q["is_required"],
                    "is_conditional": q.get("is_conditional", False)
                })
            
            new_questions_res = supabase.table("questions").insert(questions_to_insert).execute()
            new_survey["questions"] = new_questions_res.data
        else:
            new_survey["questions"] = []
            
        new_survey["response_count"] = 0
            
        return new_survey
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/surveys/{survey_id}/translate-pdf")
async def translate_pdf(survey_id: str, file: UploadFile = File(...)):
    try:
        # 1. Extract text from PDF
        pdf_bytes = await file.read()
        import asyncio
        def extract_pdf():
            text_out = ""
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        text_out += text + "\n"
            return text_out
            
        pdf_text = await asyncio.to_thread(extract_pdf)
        
        # 2. Get English survey questions
        questions_res = supabase.table("questions").select("*").eq("survey_id", survey_id).order("order_index").execute()
        if not questions_res.data:
            raise HTTPException(status_code=404, detail="No questions found for this survey")
            
        import json as json_module
        english_questions_json = json_module.dumps(questions_res.data, indent=2)
        
        # 3. Call Gemini
        prompt = f"""You are a professional translator and data architect. You have been provided with an English JSON array of survey questions and the raw text extracted from a translated French PDF document.

Your task is to perfectly reconstruct the English JSON array, but with all user-facing text translated into French based on the provided PDF text.
CRITICAL RULES:
1. The JSON structure MUST be identical to the English JSON array.
2. All keys must remain exactly the same (e.g. id, type, order_index, is_required). DO NOT translate the JSON keys.
3. Keep the 'id' and 'type' values identical to the original English version.
4. Translate 'question_text' to French.
5. If 'options.choices' exists, translate all choices to French. Maintain the exact same number of choices in the exact same order.
6. YOU MUST properly escape all double quotes (\") inside your French translations to ensure valid JSON syntax.
7. Return ONLY the valid JSON array.

--- ENGLISH JSON ARRAY ---
{english_questions_json}

--- EXTRACTED FRENCH PDF TEXT ---
{pdf_text}
"""
        
        GOOGLE_AI_KEY = os.environ.get("GOOGLE_AI_KEY")
        if not GOOGLE_AI_KEY:
            raise HTTPException(status_code=500, detail="Google AI API key not configured")
        
        import httpx
        GEMINI_MODEL = "gemini-3.5-flash"
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GOOGLE_AI_KEY}"
        
        async with httpx.AsyncClient(timeout=90.0) as client:
            gemini_res = await client.post(gemini_url, json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 8192
                }
            })
            
        if gemini_res.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Gemini API error: {gemini_res.text[:500]}")
            
        gemini_data = gemini_res.json()
        raw_text = gemini_data["candidates"][0]["content"]["parts"][0]["text"]
        
        cleaned = raw_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        try:
            translated_questions = json_module.loads(cleaned)
        except json_module.JSONDecodeError as e:
            # The AI generated invalid JSON (often unescaped quotes). Let's use json-repair to fix it automatically!
            try:
                import json_repair
                translated_questions = json_repair.loads(raw_text)
                if not isinstance(translated_questions, list):
                    raise ValueError("Repaired JSON is not a list")
            except Exception as repair_error:
                print("JSON REPAIR FAILED. RAW OUTPUT:", raw_text)
                raise HTTPException(status_code=500, detail=f"AI returned deeply invalid JSON structure. Repair failed: {str(repair_error)}. Original error: {str(e)}")
        
        # 4. Save to database using ai_analyses table as a generic JSON store for this survey
        existing = supabase.table("ai_analyses").select("id").eq("survey_id", survey_id).eq("analysis_type", "translation_fr").execute()
        if existing.data:
            supabase.table("ai_analyses").update({
                "data": translated_questions,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("ai_analyses").insert({
                "survey_id": survey_id,
                "analysis_type": "translation_fr",
                "data": translated_questions,
                "updated_at": datetime.utcnow().isoformat()
            }).execute()
            
        return {"success": True, "questions_fr": translated_questions}
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/surveys/{survey_id}/translation")
async def get_survey_translation(survey_id: str):
    """Fetch the French translated questions if they exist."""
    try:
        res = supabase.table("ai_analyses").select("data").eq("survey_id", survey_id).eq("analysis_type", "translation_fr").execute()
        if res.data:
            return {"questions_fr": res.data[0]["data"]}
        return {"questions_fr": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/surveys/{survey_id}/translation")
async def update_survey_translation(survey_id: str, request: Request):
    """Manually update the French translated questions JSON."""
    try:
        body = await request.json()
        questions_fr = body.get("questions_fr")
        if not questions_fr:
            raise HTTPException(status_code=400, detail="Missing questions_fr array")

        existing = supabase.table("ai_analyses").select("id").eq("survey_id", survey_id).eq("analysis_type", "translation_fr").execute()
        if existing.data:
            supabase.table("ai_analyses").update({
                "data": questions_fr,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("ai_analyses").insert({
                "survey_id": survey_id,
                "analysis_type": "translation_fr",
                "data": questions_fr,
                "updated_at": datetime.utcnow().isoformat()
            }).execute()
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/surveys/{survey_id}", response_model=SurveyDetail)
async def update_survey(survey_id: str, survey: SurveyCreate):
    """Update an existing survey and its questions. Fails if the survey has ever been published."""
    try:
        # 1. Check if existing survey has been published
        existing_res = supabase.table("surveys").select("has_been_published").eq("id", survey_id).execute()
        if not existing_res.data:
            raise HTTPException(status_code=404, detail="Survey not found")
        
        # Enforce editing lock
        if existing_res.data[0]["has_been_published"]:
            raise HTTPException(status_code=400, detail="Cannot edit a survey that has been published and locked.")

        has_been_published = survey.is_active or existing_res.data[0]["has_been_published"]

        # 2. Update Survey
        survey_res = supabase.table("surveys").update({
            "title": survey.title,
            "description": survey.description,
            "description_alignment": survey.description_alignment,
            "estimated_minutes": survey.estimated_minutes,
            "is_active": survey.is_active,
            "has_been_published": has_been_published,
            "thumbnail_url": survey.thumbnail_url,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", survey_id).execute()
        
        updated_survey = survey_res.data[0]
        
        # 3. Delete existing questions
        supabase.table("questions").delete().eq("survey_id", survey_id).execute()
        
        # 4. Insert new questions
        if survey.questions:
            questions_to_insert = []
            for q in survey.questions:
                questions_to_insert.append({
                    "survey_id": updated_survey["id"],
                    "question_text": q.question_text,
                    "type": q.type,
                    "order_index": q.order_index,
                    "options": q.options,
                    "is_required": q.is_required,
                    "is_conditional": q.is_conditional
                })
            
            questions_res = supabase.table("questions").insert(questions_to_insert).execute()
            updated_survey["questions"] = questions_res.data
        else:
            updated_survey["questions"] = []
            
        updated_survey["response_count"] = 0 # Dummy count for response_model
            
        return updated_survey
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SessionCreate(BaseModel):
    email: str
    referral_source: Optional[str] = None

class AnswerUpsert(BaseModel):
    question_id: str
    answer_text: Optional[str] = None
    answer_numeric: Optional[int] = None
    answer_options: Optional[Any] = None
    time_spent: Optional[int] = 0

class CheckStatusRequest(BaseModel):
    email: str

@app.post("/api/surveys/{survey_id}/check-status")
async def check_survey_status(survey_id: str, body: CheckStatusRequest):
    """Check if the given email has already submitted the survey."""
    try:
        existing = supabase.table("response_sessions").select("id").eq(
            "survey_id", survey_id
        ).eq("email", body.email).eq("is_completed", True).execute()
        return {"has_submitted": bool(existing.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/profile-data")
async def get_user_profile_data(email: str):
    """Fetch past answers for an email to populate conditional fields."""
    try:
        sessions = supabase.table("response_sessions").select("id").eq("email", email).eq("is_completed", True).execute()
        if not sessions.data:
            return {}
        
        session_ids = [s["id"] for s in sessions.data]
        
        # Get answers joined with question text
        answers = supabase.table("answers").select("*, questions(question_text)").in_("session_id", session_ids).execute()
        
        profile_data = {}
        for ans in answers.data:
            q_info = ans.get("questions")
            if q_info and isinstance(q_info, dict):
                q_text = q_info.get("question_text")
                if q_text:
                    profile_data[q_text] = {
                        "answer_text": ans.get("answer_text"),
                        "answer_numeric": ans.get("answer_numeric"),
                        "answer_options": ans.get("answer_options")
                    }
                    
        return profile_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/surveys/{survey_id}/sessions")
async def create_session(survey_id: str, body: SessionCreate):
    """Create a new partial response session when user enters their email."""
    try:
        # Check if there's already an incomplete session for this email + survey
        existing = supabase.table("response_sessions").select("id", "current_step").eq(
            "survey_id", survey_id
        ).eq("email", body.email).eq("is_completed", False).execute()

        if existing.data:
            # Return existing session for resume
            session = existing.data[0]
            # Fetch saved answers
            answers_res = supabase.table("answers").select("*").eq("session_id", session["id"]).execute()
            return {"session_id": session["id"], "current_step": session.get("current_step", 0), "saved_answers": answers_res.data, "resumed": True}

        session_data = {
            "survey_id": survey_id,
            "email": body.email,
            "is_completed": False,
            "current_step": 0
        }
        if body.referral_source:
            session_data["referral_source"] = body.referral_source
        session_res = supabase.table("response_sessions").insert(session_data).execute()

        return {"session_id": session_res.data[0]["id"], "current_step": 0, "saved_answers": [], "resumed": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/sessions/{session_id}/answers")
async def upsert_answer(session_id: str, body: AnswerUpsert):
    """Save or update a single answer for a session (auto-save on Next)."""
    try:
        # Check if answer already exists for this session + question
        existing = supabase.table("answers").select("id").eq(
            "session_id", session_id
        ).eq("question_id", body.question_id).execute()

        if existing.data:
            # Update existing
            supabase.table("answers").update({
                "answer_text": body.answer_text,
                "answer_numeric": body.answer_numeric,
                "answer_options": body.answer_options,
                "time_spent": body.time_spent
            }).eq("id", existing.data[0]["id"]).execute()
        else:
            # Insert new
            supabase.table("answers").insert({
                "session_id": session_id,
                "question_id": body.question_id,
                "answer_text": body.answer_text,
                "answer_numeric": body.answer_numeric,
                "answer_options": body.answer_options,
                "time_spent": body.time_spent
            }).execute()

        return {"status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/sessions/{session_id}/step")
async def update_step(session_id: str, body: dict):
    """Update the current step for a session (for resume)."""
    try:
        supabase.table("response_sessions").update({
            "current_step": body.get("current_step", 0)
        }).eq("id", session_id).execute()
        return {"status": "updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sessions/{session_id}/attention-failure")
async def report_attention_failure(session_id: str):
    """Report a failed attention check for a session."""
    try:
        session_res = supabase.table("response_sessions").select("attention_check_failures").eq("id", session_id).execute()
        if not session_res.data:
            raise HTTPException(status_code=404, detail="Session not found")
            
        failures = session_res.data[0].get("attention_check_failures", 0)
        if failures is None:
            failures = 0
        failures += 1
        
        weight = 1.0
        is_valid = True
        
        if failures == 1:
            weight = 0.5
        elif failures >= 2:
            weight = 0.0
            is_valid = False
            
        supabase.table("response_sessions").update({
            "attention_check_failures": failures,
            "weight": weight,
            "is_valid": is_valid
        }).eq("id", session_id).execute()
        
        return {"status": "updated", "failures": failures, "weight": weight, "is_valid": is_valid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/sessions/{session_id}/complete")
async def complete_session(session_id: str):
    """Mark a session as complete."""
    try:
        supabase.table("response_sessions").update({
            "is_completed": True,
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", session_id).execute()
        return {"status": "completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/surveys/{survey_id}/responses")
async def submit_response(survey_id: str, submission: ResponseSubmission):
    """Legacy: Submit a full response at once (fallback)."""
    try:
        session_res = supabase.table("response_sessions").insert({
            "survey_id": survey_id,
            "email": submission.email,
            "is_completed": True,
            "completed_at": datetime.utcnow().isoformat()
        }).execute()
        
        session_id = session_res.data[0]["id"]
        
        answers_to_insert = []
        for answer in submission.answers:
            answers_to_insert.append({
                "session_id": session_id,
                "question_id": answer.question_id,
                "answer_text": answer.answer_text,
                "answer_numeric": answer.answer_numeric,
                "answer_options": answer.answer_options,
                "time_spent": answer.time_spent
            })
            
        if answers_to_insert:
            supabase.table("answers").insert(answers_to_insert).execute()
            
        return {"status": "success", "session_id": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/surveys/{survey_id}/results")
async def get_survey_results(survey_id: str):
    """Get all responses and answers for a survey, grouped by session."""
    try:
        # Fetch survey with questions
        survey_res = supabase.table("surveys").select("*").eq("id", survey_id).execute()
        if not survey_res.data:
            raise HTTPException(status_code=404, detail="Survey not found")
        survey = survey_res.data[0]

        questions_res = supabase.table("questions").select("*").eq("survey_id", survey_id).order("order_index").execute()
        questions = questions_res.data

        # Fetch all sessions for this survey
        sessions_res = supabase.table("response_sessions").select("*").eq("survey_id", survey_id).order("completed_at", desc=True).execute()
        sessions = sessions_res.data

        # Fetch all answers for all sessions in one query
        session_ids = [s["id"] for s in sessions]
        all_answers = []
        if session_ids:
            answers_res = supabase.table("answers").select("*").in_("session_id", session_ids).execute()
            all_answers = answers_res.data

        # Group answers by session
        answers_by_session = {}
        for a in all_answers:
            sid = a["session_id"]
            if sid not in answers_by_session:
                answers_by_session[sid] = []
            answers_by_session[sid].append(a)

        # Build response objects
        responses = []
        referral_counts = {}
        for s in sessions:
            ref = s.get("referral_source") or "Direct"
            referral_counts[ref] = referral_counts.get(ref, 0) + 1
            responses.append({
                "session_id": s["id"],
                "completed_at": s.get("completed_at"),
                "referral_source": s.get("referral_source"),
                "attention_check_failures": s.get("attention_check_failures", 0),
                "weight": s.get("weight", 1.0),
                "is_valid": s.get("is_valid", True),
                "answers": answers_by_session.get(s["id"], [])
            })

        return {
            "survey": survey,
            "questions": questions,
            "responses": responses,
            "total_responses": len(sessions),
            "referral_breakdown": referral_counts
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/surveys/{survey_id}/responses")
async def delete_all_responses(survey_id: str):
    """Delete all response sessions and their answers for a survey."""
    try:
        # Cascade: deleting sessions will auto-delete answers via ON DELETE CASCADE
        supabase.table("response_sessions").delete().eq("survey_id", survey_id).execute()
        return {"success": True, "message": "All responses deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/responses/{session_id}")
async def delete_single_response(session_id: str):
    """Delete a single response session and its answers."""
    try:
        supabase.table("response_sessions").delete().eq("id", session_id).execute()
        return {"success": True, "message": "Response deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/surveys/{survey_id}")
async def delete_survey(survey_id: str):
    """Delete a survey and all its associated data (cascade)."""
    try:
        # Check if exists
        existing = supabase.table("surveys").select("id").eq("id", survey_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Survey not found")
            
        # Delete survey (Postgres ON DELETE CASCADE handles questions, sessions, and answers)
        supabase.table("surveys").delete().eq("id", survey_id).execute()
        
        return {"success": True, "message": "Survey and all related data deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/surveys/{survey_id}/toggle", response_model=SurveyList)
async def toggle_survey_status(survey_id: str):
    """Toggle a survey's active status."""
    try:
        existing = supabase.table("surveys").select("is_active", "has_been_published").eq("id", survey_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Survey not found")
            
        current = existing.data[0]
        new_status = not current["is_active"]
            
        res = supabase.table("surveys").update({
            "is_active": new_status,
            "has_been_published": True if new_status else current["has_been_published"],
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", survey_id).execute()
        
        updated = res.data[0]
        updated["response_count"] = 0
        return updated
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- SHARE LINKS ---

class ShareLinkCreate(BaseModel):
    label: Optional[str] = None

@app.post("/api/surveys/{survey_id}/share-links")
async def create_share_link(survey_id: str, body: ShareLinkCreate):
    """Generate a unique share link code for a survey."""
    try:
        code = ''.join(random.choices(string.ascii_letters + string.digits, k=7))
        row = {
            "survey_id": survey_id,
            "code": code,
            "label": body.label or None
        }
        res = supabase.table("share_links").insert(row).execute()
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/surveys/{survey_id}/share-links")
async def get_share_links(survey_id: str):
    """Get all share links for a survey with their response counts."""
    try:
        links_res = supabase.table("share_links").select("*").eq("survey_id", survey_id).order("created_at", desc=True).execute()
        links = links_res.data

        if not links:
            return []

        # Get response counts per referral_source code
        codes = [l["code"] for l in links]
        sessions_res = supabase.table("response_sessions").select("referral_source").eq("survey_id", survey_id).in_("referral_source", codes).execute()

        counts = {}
        for s in sessions_res.data:
            ref = s.get("referral_source")
            if ref:
                counts[ref] = counts.get(ref, 0) + 1

        for link in links:
            link["response_count"] = counts.get(link["code"], 0)

        return links
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/share-links/{link_id}")
async def delete_share_link(link_id: str):
    """Delete a share link."""
    try:
        supabase.table("share_links").delete().eq("id", link_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- AI ANALYSIS SUITE ---

import httpx
import json as json_module

GEMINI_MODEL = "gemini-3.5-flash"

class AIAnalysisRequest(BaseModel):
    force_refresh: bool = False

def _gather_survey_data(survey_id: str):
    """Shared helper: gather all survey data for AI analysis."""
    survey_res = supabase.table("surveys").select("*").eq("id", survey_id).execute()
    if not survey_res.data:
        raise HTTPException(status_code=404, detail="Survey not found")
    survey = survey_res.data[0]

    questions_res = supabase.table("questions").select("*").eq("survey_id", survey_id).order("order_index").execute()
    questions = questions_res.data

    sessions_res = supabase.table("response_sessions").select("*").eq("survey_id", survey_id).eq("is_completed", True).execute()
    # Filter out invalid sessions
    sessions = [s for s in sessions_res.data if s.get("is_valid", True) is not False]

    if len(sessions) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 completed responses for AI analysis.")

    session_ids = [s["id"] for s in sessions]
    answers_res = supabase.table("answers").select("*").in_("session_id", session_ids).execute()
    all_answers = answers_res.data

    q_map = {q["id"]: q for q in questions}
    answers_by_session = {}
    for a in all_answers:
        sid = a["session_id"]
        if sid not in answers_by_session:
            answers_by_session[sid] = []
        answers_by_session[sid].append(a)

    respondent_profiles = []
    for s in sessions:
        profile = {"respondent_id": s["id"][:8], "answers": {}}
        for a in answers_by_session.get(s["id"], []):
            q = q_map.get(a["question_id"])
            if q:
                q_text = q["question_text"]
                if a.get("answer_text"):
                    profile["answers"][q_text] = a["answer_text"]
                elif a.get("answer_numeric") is not None:
                    profile["answers"][q_text] = a["answer_numeric"]
                elif a.get("answer_options"):
                    profile["answers"][q_text] = a["answer_options"]
        respondent_profiles.append(profile)

    questions_summary = []
    for q in questions:
        if q["type"] == "section_header":
            continue
        q_info = {"text": q["question_text"], "type": q["type"]}
        if q.get("options"):
            opts = q["options"]
            if isinstance(opts, dict):
                q_info["choices"] = opts.get("choices", [])
            elif isinstance(opts, list):
                q_info["choices"] = opts
        questions_summary.append(q_info)

    return survey, questions_summary, respondent_profiles


async def _call_gemini(prompt: str, survey_id: str, total_respondents: int):
    """Shared helper: call Gemini and parse the JSON response."""
    GOOGLE_AI_KEY = os.environ.get("GOOGLE_AI_KEY")
    if not GOOGLE_AI_KEY:
        raise HTTPException(status_code=500, detail="Google AI API key not configured")

    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GOOGLE_AI_KEY}"

    async with httpx.AsyncClient(timeout=90.0) as client:
        gemini_res = await client.post(gemini_url, json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 8192,
                "responseMimeType": "application/json"
            }
        })

    if gemini_res.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {gemini_res.status_code} - {gemini_res.text[:500]}")

    gemini_data = gemini_res.json()
    raw_text = gemini_data["candidates"][0]["content"]["parts"][0]["text"]

    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

    analysis = json_module.loads(cleaned)
    
    # Gracefully handle if the model mistakenly wraps the response in a JSON array
    if isinstance(analysis, list):
        if len(analysis) == 1 and isinstance(analysis[0], dict):
            analysis = analysis[0]
        else:
            analysis = {"data": analysis}

    analysis["meta"] = {
        "survey_id": survey_id,
        "total_respondents": total_respondents,
        "generated_at": datetime.utcnow().isoformat()
    }
    return analysis

async def handle_ai_analysis(survey_id: str, analysis_type: str, force_refresh: bool, prompt_suffix: str):
    """Handles the caching and generation flow for AI analysis."""
    if not force_refresh:
        try:
            res = supabase.table("ai_analyses").select("data").eq("survey_id", survey_id).eq("analysis_type", analysis_type).execute()
            if res.data:
                return res.data[0]["data"]
        except Exception as e:
            print(f"Warning: Failed to read AI cache: {e}")

    survey, questions_summary, profiles = _gather_survey_data(survey_id)
    if not profiles:
        raise HTTPException(status_code=400, detail="Not enough responses for AI analysis.")

    prompt = _base_context(survey, questions_summary, profiles) + prompt_suffix
    
    analysis = await _call_gemini(prompt, survey_id, len(profiles))
    
    # Save to cache
    try:
        # Get existing record to handle upsert properly without relying purely on constraint if preferred, 
        # but UPSERT should work. To be safe since we don't have primary key from client:
        existing = supabase.table("ai_analyses").select("id").eq("survey_id", survey_id).eq("analysis_type", analysis_type).execute()
        if existing.data:
            supabase.table("ai_analyses").update({
                "data": analysis,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("ai_analyses").insert({
                "survey_id": survey_id,
                "analysis_type": analysis_type,
                "data": analysis,
                "updated_at": datetime.utcnow().isoformat()
            }).execute()
    except Exception as e:
        print(f"Warning: Failed to cache AI analysis: {e}")
        
    return analysis


def _base_context(survey, questions_summary, respondent_profiles):
    """Build the shared context block for all prompts."""
    return f"""You are an expert policy research analyst working for a Canadian youth advocacy organization called CYC (Canadian Youth Cabinet).

Survey: "{survey['title']}"
Description: {survey.get('description', 'N/A')}
Total respondents: {len(respondent_profiles)}

Questions asked:
{json_module.dumps(questions_summary, indent=2)}

Respondent data (each respondent's answers):
{json_module.dumps(respondent_profiles, indent=2)}"""


# --- 1. PERSUADABILITY DETECTION ---

@app.post("/api/surveys/{survey_id}/ai-analysis")
async def ai_persuadability_analysis(survey_id: str, body: AIAnalysisRequest = AIAnalysisRequest()):
    try:
        prompt_suffix = """

Produce a Persuadability Detection report as JSON with EXACTLY this structure:
{
  "overall_summary": "2-3 sentence executive summary of the persuadability landscape.",
  "persuadability_score": { "overall": <0-100>, "label": "<Low|Moderate|High|Very High>" },
  "key_findings": [{ "title": "...", "description": "...", "confidence": "<High|Medium|Low>", "icon": "<lightbulb|trending_up|users|alert_triangle|bar_chart>" }],
  "demographic_segments": [{ "segment_name": "...", "size": <n>, "persuadability": <0-100>, "label": "<Fixed|Leaning Fixed|Moderate|Leaning Flexible|Flexible>", "key_trait": "..." }],
  "opinion_flexibility_map": [{ "topic": "...", "flexibility_score": <0-100>, "sentiment": "<Strongly Against|Against|Mixed|For|Strongly For>", "insight": "..." }],
  "recommendations": [{ "action": "...", "target_audience": "...", "rationale": "..." }]
}

Guidelines: High variance in rating/likert = persuadable. Split multiple choice = opinion still forming. Analyze sentiment strength in short answers. Be specific and data-driven. Return ONLY valid JSON."""

        return await handle_ai_analysis(survey_id, "persuadability", body.force_refresh, prompt_suffix)
    except HTTPException:
        raise
    except json_module.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- 2. PUBLIC MOOD HEATMAP ---

@app.post("/api/surveys/{survey_id}/ai-mood")
async def ai_mood_heatmap(survey_id: str, body: AIAnalysisRequest = AIAnalysisRequest()):
    try:
        prompt_suffix = """

Produce a Public Mood Heatmap report as JSON with EXACTLY this structure:
{
  "overall_mood": { "label": "<Optimistic|Anxious|Frustrated|Apathetic|Divided|Determined>", "description": "2-3 sentence summary of the overarching mood." },
  "mood_dimensions": [
    { "dimension": "A key mood dimension (e.g. 'Economic Anxiety', 'Hope for Future')", "score": <0-100 severity/intensity>, "insight": "..." }
  ],
  "emerging_concerns": [
    { "concern": "...", "urgency": "<High|Medium|Low>", "evidence": "..." }
  ]
}

Guidelines: Focus on emotional valence and intensity across responses. Look for underlying frustration, optimism, or apathy. Identify specific trigger points or issues driving negative/positive sentiment. Return ONLY valid JSON."""

        return await handle_ai_analysis(survey_id, "mood", body.force_refresh, prompt_suffix)
    except HTTPException:
        raise
    except json_module.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- 3. BELIEF NETWORK GRAPH ---

@app.post("/api/surveys/{survey_id}/ai-beliefs")
async def ai_belief_network(survey_id: str, body: AIAnalysisRequest = AIAnalysisRequest()):
    try:
        prompt_suffix = """

Produce a Hidden Belief Network report as JSON with EXACTLY this structure:
{
  "summary": "2-3 sentence summary of the core ideological or belief clusters found.",
  "belief_clusters": [
    { "cluster_name": "...", "size": "<Approximate % or descriptive size>", "description": "...", "beliefs": ["Core belief 1", "Core belief 2"] }
  ],
  "surprising_connections": [
    { "connection": "e.g., 'Pro-Environment AND Pro-Oil-Subsidies'", "why_surprising": "...", "evidence": "..." }
  ]
}

Guidelines: Look for correlations in how people answer seemingly unrelated questions. Identify clusters of respondents sharing underlying ideological frameworks or worldviews. Highlight contradictory or surprising combinations of beliefs. Return ONLY valid JSON."""

        return await handle_ai_analysis(survey_id, "beliefs", body.force_refresh, prompt_suffix)
    except HTTPException:
        raise
    except json_module.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- 4. MINORITY INSIGHT AMPLIFIER ---

@app.post("/api/surveys/{survey_id}/ai-minority")
async def ai_minority_insights(survey_id: str, body: AIAnalysisRequest = AIAnalysisRequest()):
    try:
        prompt_suffix = """

Produce a Minority Insight Amplifier report as JSON with EXACTLY this structure:
{
  "summary": "2-3 sentence overview of minority concerns detected.",
  "amplified_concerns": [
    {
      "concern": "The issue or concern",
      "percentage": <% of respondents who raised it>,
      "intensity": <0-100 intensity score>,
      "intensity_label": "<Critical|High|Elevated|Moderate>",
      "concentration": "Where/who this is concentrated among",
      "evidence": "Specific response patterns supporting this",
      "why_it_matters": "Why this warrants attention despite low volume"
    }
  ],
  "overlooked_demographics": [{ "group": "...", "concern": "...", "detail": "..." }],
  "recommended_actions": [{ "action": "...", "priority": "<High|Medium|Low>", "rationale": "..." }]
}

Guidelines: Focus on issues raised by <25% of respondents but with unusually high emotional intensity or concentration. Look for geographic/demographic clustering. Prioritize concerns with disproportionate potential impact. Detect urgency language in open-ended responses. Return ONLY valid JSON."""

        return await handle_ai_analysis(survey_id, "minority", body.force_refresh, prompt_suffix)
    except HTTPException:
        raise
    except json_module.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- 5. RESPONDENT ARCHETYPE GENERATOR ---

@app.post("/api/surveys/{survey_id}/ai-archetypes")
async def ai_archetypes(survey_id: str, body: AIAnalysisRequest = AIAnalysisRequest()):
    try:
        prompt_suffix = """

Produce a Behavioural Archetypes report as JSON with EXACTLY this structure:
{
  "summary": "2-3 sentence summary of the main personas discovered.",
  "archetypes": [
    {
      "name": "Creative archetype name (e.g. 'Pragmatic Skeptic')",
      "size": <number of respondents fitting this archetype>,
      "percentage": <% of total>,
      "description": "2-3 sentence description of this archetype",
      "key_traits": ["trait 1", "trait 2", "trait 3"],
      "values": "What this group values most",
      "policy_stance": "Their general policy orientation",
      "engagement_level": "<Highly Engaged|Engaged|Moderate|Low|Disengaged>"
    }
  ],
  "archetype_comparison": [
    { "dimension": "A key dimension (e.g. 'Trust in Government')", "scores": { "<archetype_name>": <0-100> } }
  ],
  "implications": [{ "insight": "...", "recommendation": "..." }]
}

Guidelines: Cluster respondents by recurring patterns in attitudes, values, and priorities. Go beyond simple demographics — create meaningful behavioural personas. Give each archetype an intuitive, memorable name. Provide 3-5 archetypes. Return ONLY valid JSON."""

        return await handle_ai_analysis(survey_id, "archetypes", body.force_refresh, prompt_suffix)
    except HTTPException:
        raise
    except json_module.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- 6. SURVEY BLIND SPOT ANALYZER ---

@app.post("/api/surveys/{survey_id}/ai-blindspots")
async def ai_blindspots(survey_id: str, body: AIAnalysisRequest = AIAnalysisRequest()):
    try:
        prompt_suffix = """

Produce a Survey Blind Spot Analyzer report as JSON with EXACTLY this structure:
{
  "summary": "2-3 sentence overview of the survey's coverage and gaps.",
  "coverage_score": { "overall": <0-100>, "label": "<Comprehensive|Good|Moderate|Limited|Narrow>" },
  "blind_spots": [
    {
      "topic": "The underexplored topic",
      "severity": "<Critical|Significant|Minor>",
      "evidence": "What in the responses suggests this gap",
      "suggested_questions": ["Specific question to add in future"]
    }
  ],
  "emerging_themes": [
    { "theme": "...", "frequency": "<Frequent|Occasional|Rare>", "source": "Where this appeared (e.g. open-ended responses)", "detail": "..." }
  ],
  "methodology_flags": [
    { "issue": "...", "severity": "<High|Medium|Low>", "suggestion": "..." }
  ],
  "improvement_recommendations": [
    { "recommendation": "...", "priority": "<High|Medium|Low>", "rationale": "..." }
  ]
}

Guidelines: Review which topics the survey covers well and where gaps exist. Look for recurring themes in open-ended responses not reflected in structured questions. Flag potential question bias or missing response options. Suggest specific new questions for future iterations. Return ONLY valid JSON."""

        return await handle_ai_analysis(survey_id, "blindspots", body.force_refresh, prompt_suffix)
    except HTTPException:
        raise
    except json_module.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

