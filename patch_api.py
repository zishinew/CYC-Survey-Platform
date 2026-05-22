import re

with open("api/index.py", "r") as f:
    content = f.read()

# Replace get_survey_translation
old_get = """@app.get("/api/surveys/{survey_id}/translation")
async def get_survey_translation(survey_id: str):
    \"\"\"Fetch the French translated questions if they exist.\"\"\"
    try:
        res = supabase.table("ai_analyses").select("data").eq("survey_id", survey_id).eq("analysis_type", "translation_fr").execute()
        if res.data:
            data = res.data[0]["data"]
            if isinstance(data, list):
                return {"questions_fr": data, "title_fr": None, "description_fr": None}
            if isinstance(data, dict):
                return {
                    "questions_fr": data.get("questions_fr"),
                    "title_fr": data.get("title_fr"),
                    "description_fr": data.get("description_fr"),
                }
            return {"questions_fr": None, "title_fr": None, "description_fr": None}
        return {"questions_fr": None, "title_fr": None, "description_fr": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))"""

new_get = """@app.get("/api/surveys/{survey_id}/translation")
async def get_survey_translation(survey_id: str):
    \"\"\"Fetch the translated questions if they exist.\"\"\"
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
        raise HTTPException(status_code=500, detail=str(e))"""

content = content.replace(old_get, new_get)

# Replace update_survey_translation
old_put = """@app.put("/api/surveys/{survey_id}/translation")
async def update_survey_translation(survey_id: str, request: Request):
    \"\"\"Manually update the French translated questions JSON.\"\"\"
    try:
        body = await request.json()
        questions_fr = body.get("questions_fr")
        title_fr = body.get("title_fr")
        description_fr = body.get("description_fr")
        if not questions_fr:
            raise HTTPException(status_code=400, detail="Missing questions_fr array")

        payload = {
            "questions_fr": questions_fr,
            "title_fr": title_fr,
            "description_fr": description_fr,
        }

        existing = supabase.table("ai_analyses").select("id").eq("survey_id", survey_id).eq("analysis_type", "translation_fr").execute()
        if existing.data:
            supabase.table("ai_analyses").update({
                "data": payload,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("ai_analyses").insert({
                "survey_id": survey_id,
                "analysis_type": "translation_fr",
                "data": payload,
                "updated_at": datetime.utcnow().isoformat()
            }).execute()
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))"""

new_put = """@app.put("/api/surveys/{survey_id}/translation")
async def update_survey_translation(survey_id: str, request: Request):
    \"\"\"Manually update the translated questions JSON.\"\"\"
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
        raise HTTPException(status_code=500, detail=str(e))"""

content = content.replace(old_put, new_put)

with open("api/index.py", "w") as f:
    f.write(content)

print("api/index.py updated.")
