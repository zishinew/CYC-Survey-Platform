import requests

with open("scratch/dummy.pdf", "w") as f:
    f.write("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF")

res = requests.post("http://localhost:8000/api/surveys/survey-123/translate-pdf", files={"file": ("dummy.pdf", open("scratch/dummy.pdf", "rb"))})
print("STATUS:", res.status_code)
print("BODY:", res.text)
