import requests

base_url = "http://127.0.0.1:3000/api"
survey_id = "c1ef4af9-a2b2-43ad-8e08-defad3baeb35"

try:
    print("Testing /results")
    res = requests.get(f"{base_url}/surveys/{survey_id}/results")
    print(res.status_code)
except Exception as e:
    print(e)
