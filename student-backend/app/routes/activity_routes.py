from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..schemas import ActivityTrackRequest
from ..services.activity_service import record_activity

router = APIRouter(prefix='/api/activity', tags=['activity'])


@router.post('/track')
async def track_activity(payload: ActivityTrackRequest, current_user=Depends(get_current_user)):
    # Heartbeats update presence without filling the activity feed with repetitive events.
    create_event = payload.action != 'heartbeat'
    await record_activity(
        current_user,
        action=payload.action,
        page=payload.page,
        metadata=payload.metadata,
        create_event=create_event,
    )
    return {'ok': True}
