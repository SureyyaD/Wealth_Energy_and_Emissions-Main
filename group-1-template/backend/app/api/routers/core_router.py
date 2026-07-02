from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse

from app.api.routers.data_routes import data_router
from app.api.routers.demo_routes import demo_router
from app.api.routers.openai_router import router as openai_router

# use function to avoid import time side effects
def build_router() -> APIRouter:
    # create global router used by api_app in asgi.py
    # /api prefix matches browser fetches (VITE_BACKEND_API_URL + /api/...) and Vite dev proxy
    combined_router = APIRouter(prefix="/api")

    # mount imported routers
    combined_router.include_router(demo_router)
    combined_router.include_router(data_router)
    combined_router.include_router(openai_router)
    
    # add core defaults
    @combined_router.get("/", include_in_schema=False)
    def root(request: Request):
        # "swagger_ui_html" is the FastAPI-internal route name for /docs
        url = request.url_for("swagger_ui_html")
        return RedirectResponse(url=url)  # careful the redirect uses the root_path set in asgi.py!

    return combined_router
