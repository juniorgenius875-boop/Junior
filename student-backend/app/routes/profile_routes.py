from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from ..auth import get_current_user
from ..database import get_db
from ..schemas import ProfileData

router = APIRouter(prefix='/api/profile', tags=['profile'])


@router.get('')
async def get_profile(current_user=Depends(get_current_user)):
    return current_user.get('profile', {})


@router.put('')
async def update_profile(payload: ProfileData, current_user=Depends(get_current_user)):
    profile = payload.model_dump()
    await get_db().users.update_one(
        {'_id': current_user['_id']},
        {'$set': {'profile': profile, 'updated_at': datetime.now(timezone.utc)}},
    )
    return profile


@router.get('/stats')
async def get_profile_stats(current_user=Depends(get_current_user)):
    db = get_db()
    test_results = await db.test_results.find({'user_id': current_user['_id']}).to_list(None)
    percentages = [
        (item.get('score', 0) / item.get('total_marks', 1)) * 100
        for item in test_results
        if item.get('total_marks', 0) > 0
    ]
    return {
        'totalTests': len(percentages),
        'bestScore': round(max(percentages), 1) if percentages else 0,
        'averageScore': round(sum(percentages) / len(percentages), 1) if percentages else 0,
        'level': (len(percentages) // 2) + 1,
    }
