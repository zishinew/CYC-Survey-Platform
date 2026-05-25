import urllib.request
import urllib.error
import json
import time

base_url = "http://127.0.0.1:8000/api/surveys/c1ef4af9-a2b2-43ad-8e08-defad3baeb35"

def test_endpoint(endpoint):
    print(f"\nTesting {endpoint} endpoint...")
    t0 = time.time()
    req = urllib.request.Request(f"{base_url}{endpoint}")
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"Time: {time.time() - t0:.2f}s")
            return data
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} - {e.read().decode()}")
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

res = test_endpoint("/results")
if res:
    print("Keys in results:", res.keys())
    print("Total responses:", res.get("total_responses"))

res = test_endpoint("/summary")
if res:
    print("Number of questions with summary:", len(res.keys()))

res = test_endpoint("/responses/paginated?offset=0&limit=1")
if res:
    print("Total responses paginated count:", res.get("total"))
    print("Responses returned:", len(res.get("responses", [])))
