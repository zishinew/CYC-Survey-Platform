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
                "answer_options": body.answer_options
            }).eq("id", existing.data[0]["id"]).execute()
        else:
            # Insert new
            supabase.table("answers").insert({
                "session_id": session_id,
                "question_id": body.question_id,
                "answer_text": body.answer_text,
                "answer_numeric": body.answer_numeric,
                "answer_options": body.answer_options
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
                "answer_options": answer.answer_options
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
