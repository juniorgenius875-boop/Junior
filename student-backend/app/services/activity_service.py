from datetime import datetime, timezone
from typing import Any

from ..database import get_db


async def record_activity(
    user: dict,
    action: str,
    page: str | None = None,
    metadata: dict[str, Any] | None = None,
    *,
    create_event: bool = True,
):
    """Update lightweight presence fields and optionally append an activity event."""
    now = datetime.now(timezone.utc)
    db = get_db()

    update_fields = {
        'last_seen_at': now,
        'updated_at': now,
    }
    if action != 'heartbeat':
        update_fields['last_activity_at'] = now
        update_fields['last_activity_type'] = action
    if page:
        update_fields['current_page'] = page

    await db.users.update_one({'_id': user['_id']}, {'$set': update_fields})

    if create_event:
        event = {
            'user_id': user['_id'],
            'action': action,
            'page': page,
            'metadata': metadata or {},
            'created_at': now,
        }
        await db.activity_log.insert_one(event)

    return now
