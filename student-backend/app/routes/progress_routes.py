from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from pymongo import DESCENDING
from ..auth import get_current_user
from ..database import get_db
from ..schemas import ProgressCreate
from ..services.activity_service import record_activity

router = APIRouter(prefix='/api/progress', tags=['progress'])


def serialize(doc: dict) -> dict:
    return {
        **{k: v for k, v in doc.items() if k not in {'_id', 'user_id'}},
        'id': str(doc['_id']),
    }


@router.post('')
async def save_progress(payload: ProgressCreate, current_user=Depends(get_current_user)):
    doc = {
        'user_id': current_user['_id'],
        **payload.model_dump(),
        'created_at': datetime.now(timezone.utc),
    }
    result = await get_db().student_progress.insert_one(doc)
    doc['_id'] = result.inserted_id
    await record_activity(current_user, 'prediction_saved', '/predict', {'risk_level': payload.risk_level, 'total_predicted_marks': payload.total_predicted_marks})
    return serialize(doc)


@router.get('')
async def list_progress(
    limit: int = Query(100, ge=1, le=500),
    current_user=Depends(get_current_user),
):
    cursor = get_db().student_progress.find({'user_id': current_user['_id']}).sort('created_at', DESCENDING).limit(limit)
    docs = await cursor.to_list(None)
    return [serialize(doc) for doc in docs]


@router.get('/latest')
async def latest_progress(current_user=Depends(get_current_user)):
    doc = await get_db().student_progress.find_one(
        {'user_id': current_user['_id']},
        sort=[('created_at', DESCENDING)],
    )
    return serialize(doc) if doc else None
