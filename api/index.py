from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Request
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
import math
from statistics import median

# --- STATS MATH HELPERS ---
def calculate_median(arr):
    if not arr: return 0
    return median(arr)

def calculate_std_dev(arr, mean):
    if len(arr) < 2: return 0
    variance = sum((x - mean) ** 2 for x in arr) / (len(arr) - 1)
    return math.sqrt(variance)

def calculate_quartiles(arr):
    if not arr: return {"q1": 0, "q3": 0, "iqr": 0}
    sorted_arr = sorted(arr)
    mid = len(sorted_arr) // 2
    lower_half = sorted_arr[:mid]
    upper_half = sorted_arr[mid if len(sorted_arr) % 2 == 0 else mid + 1:]
    q1 = calculate_median(lower_half)
    q3 = calculate_median(upper_half)
    return {"q1": q1, "q3": q3, "iqr": q3 - q1}

def find_outliers(arr, q1, q3, iqr):
    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    return [x for x in arr if x < lower_bound or x > upperBound]

def calculate_mode(counts):
    max_val = 0
    modes = []
    for k, v in counts.items():
        if v > max_val:
            max_val = v
            modes = [k]
        elif v == max_val and max_val > 0:
            modes.append(k)
    return {"modes": modes, "count": max_val} if modes else None

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



@app.get("/api/surveys/{survey_id}/translation")
async def get_survey_translation(survey_id: str):
    """Fetch the translated questions if they exist."""
    try:
        res_fr = supabase.table("ai_analyses").select("data").eq("survey_id", survey_id).eq("analysis_type", "translation_fr").execute()
        res_zh = supabase.table("ai_analyses").select("data").eq("survey_id", survey_id).eq("analysis_type", "translation_zh").execute()
        
        result = {
            "questions_fr": None, "title_fr": None, "description_fr": None,
            "questions_zh": None, "title_zh": None, "description_zh": None,
        }
        
        if res_fr.data:
            data_fr = res_fr.data[0]["data"]
            if isinstance(data_fr, list):
                result["questions_fr"] = data_fr
            elif isinstance(data_fr, dict):
                result["questions_fr"] = data_fr.get("questions_fr")
                result["title_fr"] = data_fr.get("title_fr")
                result["description_fr"] = data_fr.get("description_fr")
                
        if res_zh.data:
            data_zh = res_zh.data[0]["data"]
            if isinstance(data_zh, list):
                result["questions_zh"] = data_zh
            elif isinstance(data_zh, dict):
                result["questions_zh"] = data_zh.get("questions_zh")
                result["title_zh"] = data_zh.get("title_zh")
                result["description_zh"] = data_zh.get("description_zh")
                
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/surveys/{survey_id}/translation")
async def update_survey_translation(survey_id: str, request: Request):
    """Manually update the translated questions JSON."""
    try:
        body = await request.json()
        
        # FR Translation
        questions_fr = body.get("questions_fr")
        if questions_fr is not None:
            payload_fr = {
                "questions_fr": questions_fr,
                "title_fr": body.get("title_fr"),
                "description_fr": body.get("description_fr"),
            }
            existing_fr = supabase.table("ai_analyses").select("id").eq("survey_id", survey_id).eq("analysis_type", "translation_fr").execute()
            if existing_fr.data:
                supabase.table("ai_analyses").update({
                    "data": payload_fr,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", existing_fr.data[0]["id"]).execute()
            else:
                supabase.table("ai_analyses").insert({
                    "survey_id": survey_id,
                    "analysis_type": "translation_fr",
                    "data": payload_fr,
                    "updated_at": datetime.utcnow().isoformat()
                }).execute()
                
        # ZH Translation
        questions_zh = body.get("questions_zh")
        if questions_zh is not None:
            payload_zh = {
                "questions_zh": questions_zh,
                "title_zh": body.get("title_zh"),
                "description_zh": body.get("description_zh"),
            }
            existing_zh = supabase.table("ai_analyses").select("id").eq("survey_id", survey_id).eq("analysis_type", "translation_zh").execute()
            if existing_zh.data:
                supabase.table("ai_analyses").update({
                    "data": payload_zh,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", existing_zh.data[0]["id"]).execute()
            else:
                supabase.table("ai_analyses").insert({
                    "survey_id": survey_id,
                    "analysis_type": "translation_zh",
                    "data": payload_zh,
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
async def get_survey_results(
    survey_id: str,
    page: int = 1,
    limit: int = 1,
    filter_failed: bool = False,
    mode: str = "individual"
):
    """Get survey results with support for pagination, filtering, and sampling."""
    try:
        # Fetch survey with questions
        survey_res = supabase.table("surveys").select("*").eq("id", survey_id).execute()
        if not survey_res.data:
            raise HTTPException(status_code=404, detail="Survey not found")
        survey = survey_res.data[0]

        questions_res = supabase.table("questions").select("*").eq("survey_id", survey_id).order("order_index").execute()
        questions = questions_res.data

        if mode == "summary":
            # Summary Mode: Fetch ALL completed sessions using range pagination to bypass Supabase limits
            sessions = []
            offset = 0
            batch_size = 1000
            while True:
                sessions_res = supabase.table("response_sessions").select("*").eq("survey_id", survey_id).eq("is_completed", True).eq("is_valid", True).order("completed_at", desc=True).range(offset, offset + batch_size - 1).execute()
                if not sessions_res.data:
                    break
                sessions.extend(sessions_res.data)
                if len(sessions_res.data) < batch_size:
                    break
                offset += batch_size
                
            total_count = len(sessions)
            
            # Since there can be up to 1000 sessions, batch fetch answers to avoid memory/roundtrip limits
            session_ids = [s["id"] for s in sessions]
            all_answers = []
            if session_ids:
                batch_size_ans = 200
                for i in range(0, len(session_ids), batch_size_ans):
                    sub_ids = session_ids[i:i+batch_size_ans]
                    ans_res = supabase.table("answers").select("*").in_("session_id", sub_ids).execute()
                    if ans_res.data:
                        all_answers.extend(ans_res.data)
                        
            # Build a lookup for session weights
            session_weights = {s["id"]: s.get("weight", 1.0) for s in sessions}

            # Group answers by question for summary stats
            answers_by_question = {}
            for a in all_answers:
                qid = a["question_id"]
                if qid not in answers_by_question:
                    answers_by_question[qid] = []
                answers_by_question[qid].append(a)

            summary_stats = {}
            for q in questions:
                qid = q["id"]
                qtype = q["type"]
                q_answers = answers_by_question.get(qid, [])
                
                if qtype in ["multiple_choice", "dropdown"]:
                    opts = q.get("options", [])
                    if isinstance(opts, dict):
                        opts = opts.get("choices", [])
                    counts = {opt: 0 for opt in opts}
                    for a in q_answers:
                        ans_text = a.get("answer_text")
                        if ans_text and ans_text in counts:
                            counts[ans_text] += 1
                    summary_stats[qid] = {
                        "sample_size": len(q_answers),
                        "counts": counts,
                        "modeData": calculate_mode(counts)
                    }
                elif qtype == "checkboxes":
                    opts = q.get("options", [])
                    if isinstance(opts, dict):
                        opts = opts.get("choices", [])
                    counts = {opt: 0 for opt in opts}
                    total_weighted = 0
                    for a in q_answers:
                        weight = session_weights.get(a["session_id"], 1.0)
                        total_weighted += weight
                        ans_opts = a.get("answer_options")
                        if ans_opts:
                            for sel in ans_opts:
                                if sel in counts:
                                    counts[sel] += weight
                    summary_stats[qid] = {
                        "sample_size": len(q_answers),
                        "total_weighted": total_weighted,
                        "counts": counts,
                        "modeData": calculate_mode(counts)
                    }
                elif qtype in ["rating_scale", "likert_scale"]:
                    nums_and_weights = []
                    for a in q_answers:
                        n = a.get("answer_numeric")
                        if n is not None:
                            w = session_weights.get(a["session_id"], 1.0)
                            nums_and_weights.append((n, w))
                    nums = [x[0] for x in nums_and_weights]
                    total_w = sum(x[1] for x in nums_and_weights)
                    mean = sum(x[0]*x[1] for x in nums_and_weights) / total_w if total_w > 0 else 0
                    median_val = calculate_median(nums)
                    std_dev = calculate_std_dev(nums, mean)
                    quartiles = calculate_quartiles(nums)
                    outliers = find_outliers(nums, quartiles["q1"], quartiles["q3"], quartiles["iqr"])
                    
                    counts = {}
                    for n in nums:
                        counts[n] = counts.get(n, 0) + 1
                        
                    summary_stats[qid] = {
                        "sample_size": len(nums),
                        "mean": mean,
                        "median": median_val,
                        "std_dev": std_dev,
                        "variance": std_dev ** 2,
                        "min": min(nums) if nums else 0,
                        "max": max(nums) if nums else 0,
                        "quartiles": quartiles,
                        "outliers": outliers,
                        "counts": counts,
                        "modeData": calculate_mode(counts)
                    }

            referral_counts = {}
            for s in sessions:
                ref = s.get("referral_source") or "Direct"
                referral_counts[ref] = referral_counts.get(ref, 0) + 1

            return {
                "survey": survey,
                "questions": questions,
                "summary_stats": summary_stats,
                "total_responses": total_count,
                "referral_breakdown": referral_counts
            }
        else:
            # Individual Mode: paginated, possibly filtered by failed attention checks
            sessions_query = supabase.table("response_sessions").select("*").eq("survey_id", survey_id).order("completed_at", desc=True)
            
            if filter_failed:
                sessions_query = sessions_query.gt("attention_check_failures", 0)
                
            # Get the exact count of filtered items
            count_res = sessions_query.execute()
            total_count = len(count_res.data) if count_res.data else 0
            
            # Fetch only the single page records
            offset = (page - 1) * limit
            paginated_query = sessions_query.range(offset, offset + limit - 1)
            sessions_res = paginated_query.execute()
            sessions = sessions_res.data or []
            
            # Fetch answers only for the paginated session IDs
            session_ids = [s["id"] for s in sessions]
            all_answers = []
            if session_ids:
                ans_res = supabase.table("answers").select("*").in_("session_id", session_ids).execute()
                all_answers = ans_res.data or []

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
                "total_responses": total_count,
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
    """Shared helper: gather all survey data and compute summary stats for AI analysis."""
    survey_res = supabase.table("surveys").select("*").eq("id", survey_id).execute()
    if not survey_res.data:
        raise HTTPException(status_code=404, detail="Survey not found")
    survey = survey_res.data[0]

    questions_res = supabase.table("questions").select("*").eq("survey_id", survey_id).order("order_index").execute()
    questions = questions_res.data

    sessions = []
    offset = 0
    batch_size = 1000
    while True:
        sessions_res = supabase.table("response_sessions").select("*").eq("survey_id", survey_id).eq("is_completed", True).eq("is_valid", True).order("completed_at", desc=True).range(offset, offset + batch_size - 1).execute()
        if not sessions_res.data:
            break
        sessions.extend(sessions_res.data)
        if len(sessions_res.data) < batch_size:
            break
        offset += batch_size

    total_count = len(sessions)
    if total_count < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 completed responses for AI analysis.")

    session_ids = [s["id"] for s in sessions]
    all_answers = []
    if session_ids:
        batch_size_ans = 200
        for i in range(0, len(session_ids), batch_size_ans):
            sub_ids = session_ids[i:i+batch_size_ans]
            ans_res = supabase.table("answers").select("*").in_("session_id", sub_ids).execute()
            if ans_res.data:
                all_answers.extend(ans_res.data)

    session_weights = {s["id"]: s.get("weight", 1.0) for s in sessions}

    answers_by_question = {}
    for a in all_answers:
        qid = a["question_id"]
        if qid not in answers_by_question:
            answers_by_question[qid] = []
        answers_by_question[qid].append(a)

    summary_stats = {}
    for q in questions:
        qid = q["id"]
        qtype = q["type"]
        q_answers = answers_by_question.get(qid, [])
        
        if qtype in ["multiple_choice", "dropdown"]:
            opts = q.get("options", [])
            if isinstance(opts, dict):
                opts = opts.get("choices", [])
            counts = {opt: 0 for opt in opts}
            for a in q_answers:
                ans_text = a.get("answer_text")
                if ans_text and ans_text in counts:
                    counts[ans_text] += 1
            summary_stats[qid] = {"counts": counts}
        elif qtype == "checkboxes":
            opts = q.get("options", [])
            if isinstance(opts, dict):
                opts = opts.get("choices", [])
            counts = {opt: 0 for opt in opts}
            for a in q_answers:
                weight = session_weights.get(a["session_id"], 1.0)
                ans_opts = a.get("answer_options")
                if ans_opts:
                    for sel in ans_opts:
                        if sel in counts:
                            counts[sel] += weight
            summary_stats[qid] = {"counts": counts}
        elif qtype in ["rating_scale", "likert_scale"]:
            nums_and_weights = []
            for a in q_answers:
                n = a.get("answer_numeric")
                if n is not None:
                    w = session_weights.get(a["session_id"], 1.0)
                    nums_and_weights.append((n, w))
            nums = [x[0] for x in nums_and_weights]
            total_w = sum(x[1] for x in nums_and_weights)
            mean = sum(x[0]*x[1] for x in nums_and_weights) / total_w if total_w > 0 else 0
            
            counts = {}
            for n in nums:
                counts[n] = counts.get(n, 0) + 1
            summary_stats[qid] = {"mean": round(mean, 1) if nums else 0, "counts": counts}

    questions_summary = []
    for q in questions:
        if q["type"] == "section_header":
            continue
        q_info = {"id": q["id"], "text": q["question_text"], "type": q["type"]}
        if q.get("options"):
            opts = q["options"]
            if isinstance(opts, dict):
                q_info["choices"] = opts.get("choices", [])
            elif isinstance(opts, list):
                q_info["choices"] = opts
        questions_summary.append(q_info)

    return survey, questions_summary, summary_stats, total_count


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

    survey, questions_summary, summary_stats, total_count = _gather_survey_data(survey_id)

    prompt = _base_context(survey, questions_summary, summary_stats, total_count) + prompt_suffix
    
    analysis = await _call_gemini(prompt, survey_id, total_count)
    
    # Save to cache
    try:
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


def _base_context(survey, questions_summary, summary_stats, total_respondents):
    """Build the shared context block for all prompts."""
    # Map the summary stats back to the question text for the prompt
    mapped_stats = {}
    for q in questions_summary:
        if q["id"] in summary_stats:
            mapped_stats[q["text"]] = summary_stats[q["id"]]

    return f"""You are an expert policy research analyst working for a Canadian youth advocacy organization called CYC (Canadian Youth Cabinet).

Survey: "{survey['title']}"
Description: {survey.get('description', 'N/A')}
Total respondents: {total_respondents}

Questions asked:
{json_module.dumps(questions_summary, indent=2)}

Survey Results (Aggregated Statistics):
{json_module.dumps(mapped_stats, indent=2)}"""


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

