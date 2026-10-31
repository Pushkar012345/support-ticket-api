import os

import requests

key = os.environ["GROQ_API_KEY"]
# Checks for a stray space or quote in the key (a common .env mistake). Shows no secret.
print("key looks clean:", key.startswith("gsk_") and key == key.strip() and '"' not in key)

headers = {"Authorization": f"Bearer {key}"}
base = "https://api.groq.com/openai/v1"

# 1. Which models does this key see?
r = requests.get(f"{base}/models", headers=headers, timeout=20)
print("list models status:", r.status_code)
if not r.ok:
    print(r.text[:300])
    raise SystemExit

ids = sorted(m["id"] for m in r.json()["data"])
print("models visible:", len(ids))

# 2. Try a tiny chat request on every model that could write text
skip = ("whisper", "guard", "tts", "orpheus", "playai", "safeguard")
for model in ids:
    if any(s in model.lower() for s in skip):
        continue
    resp = requests.post(
        f"{base}/chat/completions",
        headers=headers,
        json={"model": model, "messages": [{"role": "user", "content": "Say hi"}], "max_tokens": 20},
        timeout=30,
    )
    result = "OK" if resp.ok else resp.text[:90].replace("\n", " ")
    print(f"{model} -> {resp.status_code} {result}")