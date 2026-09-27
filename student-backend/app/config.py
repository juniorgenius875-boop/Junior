import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


def _csv_env(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(',') if item.strip()]


def _bool_env(name: str, default: str = 'false') -> bool:
    return os.getenv(name, default).strip().lower() in {'1', 'true', 'yes', 'on'}


@dataclass(frozen=True)
class Settings:
    mongodb_uri: str = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
    mongodb_db: str = os.getenv('MONGODB_DB', 'junior_genius')
    jwt_secret: str = os.getenv('JWT_SECRET', 'CHANGE_ME_IN_PRODUCTION')
    jwt_algorithm: str = os.getenv('JWT_ALGORITHM', 'HS256')
    access_token_expire_minutes: int = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '30'))
    refresh_token_expire_days: int = int(os.getenv('REFRESH_TOKEN_EXPIRE_DAYS', '7'))

    # Gemini is kept for the free-tier verifier/fallback and the existing File Search flows.
    gemini_api_key: str | None = os.getenv('GEMINI_API_KEY')
    gemini_model: str = os.getenv('GEMINI_MODEL', 'gemini-3.8-flash')
    gemini_file_search_store: str | None = os.getenv('GEMINI_FILE_SEARCH_STORE')
    gemini_direct_timeout_seconds: float = float(os.getenv('GEMINI_DIRECT_TIMEOUT_SECONDS', '10'))
    gemini_fallback_timeout_seconds: float = float(os.getenv('GEMINI_FALLBACK_TIMEOUT_SECONDS', '12'))

    # Fast primary tutor. The free Groq plan currently supports this model.
    groq_api_key: str | None = os.getenv('GROQ_API_KEY')
    groq_base_url: str = os.getenv('GROQ_BASE_URL', 'https://api.groq.com/openai/v1')
    groq_model: str = os.getenv('GROQ_MODEL', 'openai/gpt-oss-20b')
    groq_timeout_seconds: float = float(os.getenv('GROQ_TIMEOUT_SECONDS', '10'))

    # Free-model fallback router. "openrouter/free" lets OpenRouter select a free model.
    openrouter_api_key: str | None = os.getenv('OPENROUTER_API_KEY')
    openrouter_base_url: str = os.getenv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
    openrouter_model: str = os.getenv('OPENROUTER_MODEL', 'openrouter/free')
    openrouter_timeout_seconds: float = float(os.getenv('OPENROUTER_TIMEOUT_SECONDS', '12'))
    openrouter_app_name: str = os.getenv('OPENROUTER_APP_NAME', 'Junior Genius')

    # Multi-agent fan-out is used only for harder questions to protect free quotas and latency.
    free_multi_agent_for_complex: bool = _bool_env('FREE_MULTI_AGENT_FOR_COMPLEX', 'true')
    free_multi_agent_timeout_seconds: float = float(os.getenv('FREE_MULTI_AGENT_TIMEOUT_SECONDS', '11'))

    cors_origins: list[str] = None

    def __post_init__(self):
        object.__setattr__(
            self,
            'cors_origins',
            _csv_env('CORS_ORIGINS', 'http://localhost:3000'),
        )


settings = Settings()
