from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config.settings import OPENAI_API_KEY

from openai import OpenAI

router = APIRouter(prefix="/openai", tags=["openai"])

client = OpenAI(api_key=OPENAI_API_KEY)

class ChatRequest(BaseModel):
    prompt: str
    systemContext: str | None = None

@router.post("/chat")
def chat(req: ChatRequest):
    try:
        messages = []
        if req.systemContext:
            messages.append({"role": "system", "content": req.systemContext})
        messages.append({"role": "user", "content": req.prompt})

        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
        )
        return {"answer": resp.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))