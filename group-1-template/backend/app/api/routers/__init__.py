from fastapi import APIRouter
from .openai_router import router as openai_router

router = APIRouter()
router.include_router(openai_router)