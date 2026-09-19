import asyncio
import httpx

async def test():
    try:
        client = httpx.AsyncClient()
        r = await client.get('https://loan-agent-2ud4.onrender.com')
        print("Success:", r.status_code)
    except Exception as e:
        print("Error:", type(e), str(e))
    finally:
        await client.aclose()

asyncio.run(test())
