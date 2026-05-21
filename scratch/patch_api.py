import re
file_path = "api/index.py"
with open(file_path, "r") as f:
    content = f.read()

# 1. Update AnswerCreate and AnswerUpsert models
content = content.replace(
    "    answer_options: Optional[Any] = None\n\nclass ResponseSubmission(BaseModel):",
    "    answer_options: Optional[Any] = None\n    time_spent: Optional[int] = 0\n\nclass ResponseSubmission(BaseModel):"
)
content = content.replace(
    "    answer_options: Optional[Any] = None\n\nclass CheckStatusRequest(BaseModel):",
    "    answer_options: Optional[Any] = None\n    time_spent: Optional[int] = 0\n\nclass CheckStatusRequest(BaseModel):"
)

# 2. Update upsert_answer Endpoint
old_upsert_update = """            supabase.table("answers").update({
                "answer_text": body.answer_text,
                "answer_numeric": body.answer_numeric,
                "answer_options": body.answer_options
            }).eq("id", existing.data[0]["id"]).execute()"""
new_upsert_update = """            supabase.table("answers").update({
                "answer_text": body.answer_text,
                "answer_numeric": body.answer_numeric,
                "answer_options": body.answer_options,
                "time_spent": body.time_spent
            }).eq("id", existing.data[0]["id"]).execute()"""
content = content.replace(old_upsert_update, new_upsert_update)

old_upsert_insert = """            supabase.table("answers").insert({
                "session_id": session_id,
                "question_id": body.question_id,
                "answer_text": body.answer_text,
                "answer_numeric": body.answer_numeric,
                "answer_options": body.answer_options
            }).execute()"""
new_upsert_insert = """            supabase.table("answers").insert({
                "session_id": session_id,
                "question_id": body.question_id,
                "answer_text": body.answer_text,
                "answer_numeric": body.answer_numeric,
                "answer_options": body.answer_options,
                "time_spent": body.time_spent
            }).execute()"""
content = content.replace(old_upsert_insert, new_upsert_insert)

# 3. Update legacy submit_response
old_submit_append = """                "question_id": answer.question_id,
                "answer_text": answer.answer_text,
                "answer_numeric": answer.answer_numeric,
                "answer_options": answer.answer_options
            })"""
new_submit_append = """                "question_id": answer.question_id,
                "answer_text": answer.answer_text,
                "answer_numeric": answer.answer_numeric,
                "answer_options": answer.answer_options,
                "time_spent": answer.time_spent
            })"""
content = content.replace(old_submit_append, new_submit_append)

with open(file_path, "w") as f:
    f.write(content)

print("API Patched")
