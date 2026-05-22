import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv(".env.local")
GOOGLE_AI_KEY = os.getenv("GOOGLE_AI_KEY")

async def test():
    GEMINI_MODEL = "gemini-3.5-flash"
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GOOGLE_AI_KEY}"
    async with httpx.AsyncClient() as client:
        res = await client.post(gemini_url, json={
            "contents": [{"parts": [{"text": "hello"}]}],
        })
        print(res.status_code)
        print(res.text)

asyncio.run(test())
