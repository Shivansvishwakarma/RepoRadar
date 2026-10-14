
import asyncio
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise SystemExit("GEMINI_API_KEY was not found in backend/.env")

MODELS = [
    "gemini-3.6-flash",
    "gemini-3.1-flash-lite",
]


async def main():
    async with httpx.AsyncClient(timeout=45.0) as client:
        for model in MODELS:
            print(f"\nTesting {model}...")

            try:
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/"
                    f"models/{model}:generateContent",
                    headers={
                        "x-goog-api-key": api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "contents": [
                            {
                                "parts": [
                                    {"text": "Reply with exactly: RepoRadar OK"}
                                ]
                            }
                        ],
                        "generationConfig": {
                            "maxOutputTokens": 20
                        },
                    },
                )

                print("HTTP status:", response.status_code)

                if response.status_code == 200:
                    result = response.json()
                    answer = result["candidates"][0]["content"]["parts"][0]["text"]
                    print("SUCCESS:", answer)
                    print("Working model:", model)
                    return

                print("Error:", response.text[:500])

                # Try the next model only if this one fails.
                await asyncio.sleep(2)

            except httpx.RequestError as exc:
                print("Connection error:", str(exc))

    print("\nNeither test succeeded. Keep main.py unchanged for now.")


if __name__ == "__main__":
    asyncio.run(main())
