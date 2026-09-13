import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


def _csv_env(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(',') if item.strip()]


@dataclass(frozen=True)
class Settings:
    mongodb_uri: str = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
    mongodb_db: str = os.getenv('MONGODB_DB', 'junior_genius')
    jwt_secret: str = os.getenv('JWT_SECRET', 'CHANGE_ME_IN_PRODUCTION')
    jwt_algorithm: str = os.getenv('JWT_ALGORITHM', 'HS256')
    access_token_expire_minutes: int = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '30'))
    refresh_token_expire_days: int = int(os.getenv('REFRESH_TOKEN_EXPIRE_DAYS', '7'))
    gemini_api_key: str | None = os.getenv('GEMINI_API_KEY')
    gemini_model: str = os.getenv('GEMINI_MODEL', 'gemini-3.8-flash')
    gemini_file_search_store: str | None = os.getenv('GEMINI_FILE_SEARCH_STORE')
    cors_origins: list[str] = None

    def __post_init__(self):
        object.__setattr__(
            self,
            'cors_origins',
            _csv_env('CORS_ORIGINS', 'http://localhost:3000'),
        )


settings = Settings()
