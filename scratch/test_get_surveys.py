import asyncio
import httpx

async def test():
    async with httpx.AsyncClient() as client:
        res = await client.get("http://localhost:8000/api/surveys?include_inactive=true")
        print(res.status_code)
        print(res.text)

asyncio.run(test())
