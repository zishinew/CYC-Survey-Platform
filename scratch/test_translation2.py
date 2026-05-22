import requests

res = requests.post("http://localhost:8000/api/surveys/survey-123/translate-pdf", files={"file": ("dummy.pdf", open("scratch/dummy.pdf", "rb"))})
print("STATUS:", res.status_code)
print("BODY:", res.text)
