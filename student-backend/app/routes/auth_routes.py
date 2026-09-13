from datetime import datetime, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.errors import DuplicateKeyError
from ..auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)
from ..database import get_db
from ..schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix='/api/auth', tags=['auth'])


def public_user(user: dict) -> dict:
    return {
        'id': str(user['_id']),
        'email': user['email'],
        'profile': user.get('profile', {}),
        'is_active': user.get('is_active', True),
        'created_at': user.get('created_at'),
    }


def tokens_for(user: dict) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user),
        refresh_token=create_refresh_token(user),
    )


@router.post('/register')
async def register(payload: RegisterRequest):
    email = payload.email.lower().strip()
    now = datetime.now(timezone.utc)
    user = {
        'email': email,
        'password_hash': hash_password(payload.password),
        'profile': {
            'name': payload.name.strip(),
            'grade': '',
            'school': '',
            'favorite_subject': '',
            'dream_job': '',
            'hobbies': '',
        },
        'is_active': True,
        'token_version': 0,
        'created_at': now,
        'updated_at': now,
    }
    try:
        result = await get_db().users.insert_one(user)
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail='An account with this email already exists') from exc
    user['_id'] = result.inserted_id
    token_response = tokens_for(user)
    return {'user': public_user(user), **token_response.model_dump()}


@router.post('/login')
async def login(payload: LoginRequest):
    user = await get_db().users.find_one({'email': payload.email.lower().strip()})
    if not user or not verify_password(payload.password, user.get('password_hash', '')):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid email or password')
    if not user.get('is_active', True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Account is inactive')
    token_response = tokens_for(user)
    return {'user': public_user(user), **token_response.model_dump()}


@router.post('/refresh')
async def refresh(payload: RefreshRequest):
    token = decode_token(payload.refresh_token, expected_type='refresh')
    try:
        user_id = ObjectId(token['sub'])
    except Exception as exc:
        raise HTTPException(status_code=401, detail='Invalid refresh token') from exc
    user = await get_db().users.find_one({'_id': user_id})
    if not user or not user.get('is_active', True):
        raise HTTPException(status_code=401, detail='User not found or inactive')
    if int(token.get('token_version', -1)) != int(user.get('token_version', 0)):
        raise HTTPException(status_code=401, detail='Refresh token has been revoked')
    return tokens_for(user)


@router.get('/me')
async def me(current_user=Depends(get_current_user)):
    return public_user(current_user)


@router.post('/logout')
async def logout(current_user=Depends(get_current_user)):
    await get_db().users.update_one(
        {'_id': current_user['_id']},
        {'$inc': {'token_version': 1}, '$set': {'updated_at': datetime.now(timezone.utc)}},
    )
    return {'message': 'Logged out'}
