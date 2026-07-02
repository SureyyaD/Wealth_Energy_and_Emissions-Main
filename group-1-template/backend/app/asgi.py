import os

from fastapi import FastAPI
from app.lifecycle.manager import app_lifecycle
from app.api.routers.core_router import build_router
from app.config.settings import OPENAI_API_KEY

ROOT_PATH = os.getenv("ROOT_PATH", "/api")

# Global setup for the fastAPI endpoint
api_app = FastAPI(
    title="Base Python Back End",
    description="Base Python Back End API",
    version="1.0.0",
    lifespan=app_lifecycle,
    root_path=os.getenv("ROOT_PATH", "/api"),
)

from fastapi.middleware.cors import CORSMiddleware

api_app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# setup routes
api_app.include_router(build_router())
