from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import close_db, connect_db
from app.routes import activity_routes, admin_routes, ai_routes, auth_routes, prediction_routes, profile_routes, progress_routes, report_routes, test_routes
from app.services.ml_service import ml_service
from app.services.rag_service import rag_service

BASE_DIR = Path(__file__).resolve().parent


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await connect_db()
    ml_service.load(BASE_DIR / 'student_performance_artifacts.pkl')
    yield
    await close_db()


app = FastAPI(
    title='Junior Genius API',
    version='2.0.0',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
    expose_headers=['Content-Disposition'],
)

app.include_router(auth_routes.router)
app.include_router(activity_routes.router)
app.include_router(admin_routes.router)
app.include_router(profile_routes.router)
app.include_router(progress_routes.router)
app.include_router(report_routes.router)
app.include_router(prediction_routes.router)
app.include_router(test_routes.router)
app.include_router(ai_routes.router)


@app.get('/')
async def home():
    return {
        'message': 'Junior Genius API is running',
        'database': 'mongodb',
        'auth': 'jwt',
        'rag': {
            'provider': 'gemini-file-search',
            'configured': rag_service.ready,
            'model': settings.gemini_model,
        },
        'docs': '/docs',
    }


@app.get('/health')
async def health():
    return {'status': 'ok', 'ml_loaded': ml_service.ready, 'rag_configured': rag_service.ready}
