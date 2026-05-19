from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any
from supabase import create_client, Client
import os
import uuid
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

class SurveyList(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    estimated_minutes: int
    is_active: bool
    has_been_published: bool = False
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
    answers: List[AnswerCreate]

# Routes
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

class SurveyCreate(BaseModel):
    title: str
    description: Optional[str] = None
    estimated_minutes: int = 5
    is_active: bool = True
    has_been_published: bool = False
    questions: List[QuestionCreate]

@app.post("/api/surveys", response_model=SurveyDetail)
async def create_survey(survey: SurveyCreate):
    """Create a new survey and its questions"""
    try:
        # Enforce single active survey
        if survey.is_active:
            supabase.table("surveys").update({"is_active": False}).neq("is_active", False).execute()
            has_been_published = True
        else:
            has_been_published = False

        # 1. Create Survey
        survey_res = supabase.table("surveys").insert({
            "title": survey.title,
            "description": survey.description,
            "estimated_minutes": survey.estimated_minutes,
            "is_active": survey.is_active,
            "has_been_published": has_been_published
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
                    "is_required": q.is_required
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
        
        if existing_res.data[0]["has_been_published"]:
            raise HTTPException(status_code=400, detail="Cannot edit a survey that has been published and locked.")

        # Enforce single active survey
        if survey.is_active:
            supabase.table("surveys").update({"is_active": False}).neq("id", survey_id).execute()
            has_been_published = True
        else:
            has_been_published = False

        # 2. Update Survey
        survey_res = supabase.table("surveys").update({
            "title": survey.title,
            "description": survey.description,
            "estimated_minutes": survey.estimated_minutes,
            "is_active": survey.is_active,
            "has_been_published": has_been_published,
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
                    "is_required": q.is_required
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

@app.post("/api/surveys/{survey_id}/responses")
async def submit_response(survey_id: str, submission: ResponseSubmission):
    """Submit a response to a survey"""
    try:
        # 1. Create a response session
        session_res = supabase.table("response_sessions").insert({
            "survey_id": survey_id,
            "is_completed": True,
            "completed_at": datetime.utcnow().isoformat()
        }).execute()
        
        session_id = session_res.data[0]["id"]
        
        # 2. Insert all answers
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
        for s in sessions:
            responses.append({
                "session_id": s["id"],
                "completed_at": s.get("completed_at"),
                "answers": answers_by_session.get(s["id"], [])
            })

        return {
            "survey": survey,
            "questions": questions,
            "responses": responses,
            "total_responses": len(sessions)
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
    """Toggle a survey's active status. Deactivates all others if activating."""
    try:
        existing = supabase.table("surveys").select("is_active", "has_been_published").eq("id", survey_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Survey not found")
            
        current = existing.data[0]
        new_status = not current["is_active"]
        
        if new_status:
            # Setting to active: deactivate all others
            supabase.table("surveys").update({"is_active": False}).neq("id", survey_id).execute()
            
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
