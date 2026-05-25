import urllib.request
import urllib.error
import json
import time

base_url = "http://127.0.0.1:8000/api/surveys/c1ef4af9-a2b2-43ad-8e08-defad3baeb35"

print("Testing /summary with time...")
t0 = time.time()
req = urllib.request.Request(f"{base_url}/summary")
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(f"Time: {time.time() - t0:.2f}s")
except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code} - {e.read().decode()}")
