import json

cleaned = '[{"summary": "test"}]'
analysis = json.loads(cleaned)
try:
    analysis["meta"] = "test"
except Exception as e:
    print(f"Error: {type(e).__name__}: {str(e)}")
