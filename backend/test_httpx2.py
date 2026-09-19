import asyncio
import httpx

async def test():
    try:
        limits = httpx.Limits(max_connections=4, max_keepalive_connections=2)
        client = httpx.AsyncClient(limits=limits)
        
        attempt_url = "https://loan-agent-2ud4.onrender.com"
        attempt_method = "GET"
        attempt_params = {"input": "ping 0"}
        
        r = await client.request(
            method=attempt_method,
            url=attempt_url,
            params=attempt_params,
            timeout=30.0
        )
        print("Success:", r.status_code)
    except Exception as e:
        print("Error:", type(e), str(e))
    finally:
        await client.aclose()

asyncio.run(test())
