from datetime import datetime, timedelta, timezone
from uuid import uuid4
import bcrypt
import jwt
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from .config import settings
from .database import get_db

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    except (ValueError, TypeError):
        return False


def _create_token(user: dict, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        'sub': str(user['_id']),
        'email': user['email'],
        'type': token_type,
        'token_version': int(user.get('token_version', 0)),
        'iat': now,
        'exp': now + expires_delta,
        'jti': str(uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user: dict) -> str:
    return _create_token(user, 'access', timedelta(minutes=settings.access_token_expire_minutes))


def create_refresh_token(user: dict) -> str:
    return _create_token(user, 'refresh', timedelta(days=settings.refresh_token_expire_days))


def decode_token(token: str, expected_type: str | None = None) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or expired token') from exc

    if expected_type and payload.get('type') != expected_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token type')
    return payload


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Authentication required')

    payload = decode_token(credentials.credentials, expected_type='access')
    try:
        user_id = ObjectId(payload['sub'])
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token subject') from exc

    user = await get_db().users.find_one({'_id': user_id})
    if not user or not user.get('is_active', True):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found or inactive')

    if int(payload.get('token_version', -1)) != int(user.get('token_version', 0)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Session has been revoked')

    return user
