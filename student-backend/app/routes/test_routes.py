from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from pymongo import DESCENDING
from ..auth import get_current_user
from ..database import get_db
from ..schemas import TestResultCreate
from ..services.activity_service import record_activity

router = APIRouter(prefix='/api/tests', tags=['tests'])


def serialize(doc: dict) -> dict:
    return {
        **{k: v for k, v in doc.items() if k not in {'_id', 'user_id'}},
        'id': str(doc['_id']),
    }


@router.post('/results')
async def save_test_result(payload: TestResultCreate, current_user=Depends(get_current_user)):
    doc = {
        'user_id': current_user['_id'],
        **payload.model_dump(),
        'created_at': datetime.now(timezone.utc),
    }
    result = await get_db().test_results.insert_one(doc)
    doc['_id'] = result.inserted_id
    await record_activity(current_user, 'test_completed', '/test-corner', {'test_type': payload.test_type, 'difficulty': payload.difficulty, 'score': payload.score, 'total_marks': payload.total_marks})
    return serialize(doc)


@router.get('/results')
async def list_test_results(
    limit: int = Query(50, ge=1, le=200),
    current_user=Depends(get_current_user),
):
    cursor = get_db().test_results.find({'user_id': current_user['_id']}).sort('created_at', DESCENDING).limit(limit)
    docs = await cursor.to_list(None)
    return [serialize(doc) for doc in docs]
