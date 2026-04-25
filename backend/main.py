from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from groq import AsyncGroq
from dotenv import load_dotenv
from rag import build_csv_context
import os
import uuid

load_dotenv()

app = FastAPI(title="CSV Analyst AI")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store
sessions: dict[str, str] = {}

# Groq client
client = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])

MODEL = "llama-3.3-70b-versatile"


# -------------------------
# Upload endpoint
# -------------------------
@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    """
    Receives a CSV file, builds a RAG context string from it,
    stores it under a new session_id, and returns that session_id.
    """

    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    contents = await file.read()

    try:
        context = build_csv_context(contents)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not parse CSV: {exc}")

    session_id = str(uuid.uuid4())
    sessions[session_id] = context

    return {"session_id": session_id, "message": "CSV uploaded and ready."}


# -------------------------
# Chat endpoint
# -------------------------
class ChatRequest(BaseModel):
    session_id: str
    message: str


@app.post("/chat")
async def chat(request: ChatRequest):
    """
    Receives a user message + session_id.
    Retrieves the stored CSV context, injects it into the prompt,
    and streams Groq's response token-by-token back to the client.
    """

    context = sessions.get(request.session_id)
    if context is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found. Upload a CSV first.",
        )

    full_prompt = f"""
You are an expert data analyst. The user has uploaded a CSV file.
Here is the complete dataset context:

{context}

Answer questions about this data clearly and concisely.
Cite specific numbers, column names, or row values when relevant.
If a question cannot be answered from the provided data, say so explicitly.

User question: {request.message}
"""

    async def stream_response():
        stream = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "user",
                    "content": full_prompt,
                }
            ],
            max_tokens=1024,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    return StreamingResponse(stream_response(), media_type="text/plain")
