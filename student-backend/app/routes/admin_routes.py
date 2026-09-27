from datetime import datetime, timedelta, timezone
from io import BytesIO
from math import ceil
import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pymongo import DESCENDING

from ..auth import get_current_admin
from ..database import get_db
from ..services.report_pdf_service import admin_students_pdf, student_report_pdf

router = APIRouter(prefix='/api/admin', tags=['admin'])


def _as_id(value):
    return str(value) if value is not None else None


def _serialize_doc(doc: dict | None, *, remove_user_id: bool = True) -> dict | None:
    if not doc:
        return None
    result = {}
    for key, value in doc.items():
        if key == '_id':
            result['id'] = str(value)
        elif remove_user_id and key == 'user_id':
            continue
        else:
            result[key] = value
    return result


def _user_public(user: dict) -> dict:
    return {
        'id': str(user['_id']),
        'email': user.get('email', ''),
        'role': user.get('role', 'student'),
        'profile': user.get('profile', {}),
        'is_active': user.get('is_active', True),
        'created_at': user.get('created_at'),
        'last_login_at': user.get('last_login_at'),
        'last_seen_at': user.get('last_seen_at'),
        'last_activity_at': user.get('last_activity_at'),
        'last_activity_type': user.get('last_activity_type'),
        'current_page': user.get('current_page'),
    }


async def _latest_by_user(collection_name: str, user_ids: list[ObjectId]) -> dict[str, dict]:
    if not user_ids:
        return {}
    db = get_db()
    pipeline = [
        {'$match': {'user_id': {'$in': user_ids}}},
        {'$sort': {'user_id': 1, 'created_at': -1}},
        {'$group': {'_id': '$user_id', 'doc': {'$first': '$$ROOT'}}},
    ]
    cursor = await db[collection_name].aggregate(pipeline)
    rows = await cursor.to_list(None)
    return {str(row['_id']): row['doc'] for row in rows}


async def _test_stats(user_ids: list[ObjectId]) -> dict[str, dict]:
    if not user_ids:
        return {}
    pipeline = [
        {'$match': {'user_id': {'$in': user_ids}}},
        {
            '$group': {
                '_id': '$user_id',
                'count': {'$sum': 1},
                'last_test_at': {'$max': '$created_at'},
                'average_score': {
                    '$avg': {
                        '$cond': [
                            {'$gt': ['$total_marks', 0]},
                            {'$multiply': [{'$divide': ['$score', '$total_marks']}, 100]},
                            None,
                        ]
                    }
                },
            }
        },
    ]
    cursor = await get_db().test_results.aggregate(pipeline)
    rows = await cursor.to_list(None)
    return {
        str(row['_id']): {
            'count': row.get('count', 0),
            'last_test_at': row.get('last_test_at'),
            'average_score': round(row.get('average_score') or 0, 1),
        }
        for row in rows
    }


async def _chat_stats(user_ids: list[ObjectId]) -> dict[str, dict]:
    if not user_ids:
        return {}
    pipeline = [
        {'$match': {'user_id': {'$in': user_ids}}},
        {
            '$group': {
                '_id': '$user_id',
                'count': {'$sum': 1},
                'last_chat_at': {'$max': '$created_at'},
            }
        },
    ]
    cursor = await get_db().chat_history.aggregate(pipeline)
    rows = await cursor.to_list(None)
    return {
        str(row['_id']): {'count': row.get('count', 0), 'last_chat_at': row.get('last_chat_at')}
        for row in rows
    }


@router.get('/overview')
async def overview(_admin=Depends(get_current_admin)):
    db = get_db()
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)
    two_minutes_ago = now - timedelta(minutes=2)

    total_users = await db.users.count_documents({'role': {'$ne': 'admin'}})
    total_admins = await db.users.count_documents({'role': 'admin'})
    active_24h = await db.users.count_documents({'role': {'$ne': 'admin'}, 'last_seen_at': {'$gte': day_ago}})
    online_now = await db.users.count_documents({'role': {'$ne': 'admin'}, 'last_seen_at': {'$gte': two_minutes_ago}})
    tests_24h = await db.test_results.count_documents({'created_at': {'$gte': day_ago}})
    chats_24h = await db.chat_history.count_documents({'created_at': {'$gte': day_ago}})

    latest_progress_pipeline = [
        {'$sort': {'user_id': 1, 'created_at': -1}},
        {'$group': {'_id': '$user_id', 'risk_level': {'$first': '$risk_level'}}},
        {'$match': {'risk_level': {'$regex': '^high$', '$options': 'i'}}},
        {'$count': 'count'},
    ]
    high_risk_cursor = await db.student_progress.aggregate(latest_progress_pipeline)
    high_risk_rows = await high_risk_cursor.to_list(None)
    high_risk = high_risk_rows[0]['count'] if high_risk_rows else 0

    return {
        'total_users': total_users,
        'total_admins': total_admins,
        'active_24h': active_24h,
        'online_now': online_now,
        'high_risk': high_risk,
        'tests_24h': tests_24h,
        'chats_24h': chats_24h,
        'generated_at': now,
    }


@router.get('/users')
async def list_users(
    search: str = Query('', max_length=120),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    role: str = Query('student'),
    _admin=Depends(get_current_admin),
):
    db = get_db()
    query: dict = {}
    if role != 'all':
        query['role'] = {'$ne': 'admin'} if role == 'student' else role

    if search.strip():
        escaped = re.escape(search.strip())
        query['$or'] = [
            {'email': {'$regex': escaped, '$options': 'i'}},
            {'profile.name': {'$regex': escaped, '$options': 'i'}},
            {'profile.school': {'$regex': escaped, '$options': 'i'}},
        ]

    total = await db.users.count_documents(query)
    users = await db.users.find(query).sort('created_at', DESCENDING).skip((page - 1) * limit).limit(limit).to_list(None)
    user_ids = [user['_id'] for user in users]

    latest_progress = await _latest_by_user('student_progress', user_ids)
    test_stats = await _test_stats(user_ids)
    chat_stats = await _chat_stats(user_ids)

    items = []
    for user in users:
        uid = str(user['_id'])
        progress = latest_progress.get(uid)
        item = _user_public(user)
        item['latest_progress'] = _serialize_doc(progress)
        item['test_stats'] = test_stats.get(uid, {'count': 0, 'average_score': 0, 'last_test_at': None})
        item['chat_stats'] = chat_stats.get(uid, {'count': 0, 'last_chat_at': None})
        items.append(item)

    return {
        'items': items,
        'page': page,
        'limit': limit,
        'total': total,
        'pages': max(1, ceil(total / limit)) if total else 1,
    }


@router.get('/report/students')
async def students_report(_admin=Depends(get_current_admin)):
    """Structured all-student report used by the admin PDF export."""
    db = get_db()
    users = await db.users.find({'role': {'$ne': 'admin'}}).sort('created_at', DESCENDING).limit(2000).to_list(None)
    user_ids = [user['_id'] for user in users]
    latest_progress = await _latest_by_user('student_progress', user_ids)
    test_stats = await _test_stats(user_ids)
    chat_stats = await _chat_stats(user_ids)

    items = []
    for user in users:
        uid = str(user['_id'])
        item = _user_public(user)
        item['latest_progress'] = _serialize_doc(latest_progress.get(uid))
        item['test_stats'] = test_stats.get(uid, {'count': 0, 'average_score': 0, 'last_test_at': None})
        item['chat_stats'] = chat_stats.get(uid, {'count': 0, 'last_chat_at': None})
        items.append(item)

    return {
        'overview': await overview(_admin),
        'students': items,
        'generated_at': datetime.now(timezone.utc),
    }


@router.get('/report/students.pdf')
async def students_report_pdf(_admin=Depends(get_current_admin)):
    data = await students_report(_admin)
    pdf = admin_students_pdf(data)
    return StreamingResponse(
        BytesIO(pdf),
        media_type='application/pdf',
        headers={'Content-Disposition': 'attachment; filename="junior-genius-students-report.pdf"'},
    )


@router.get('/report/users/{user_id}.pdf')
async def student_report_pdf_admin(user_id: str, _admin=Depends(get_current_admin)):
    detail = await user_detail(user_id, _admin)
    pdf = student_report_pdf(detail, admin_copy=True)
    profile = detail.get('user', {}).get('profile', {}) or {}
    name = (profile.get('name') or 'student').strip().replace(' ', '-').lower()
    return StreamingResponse(
        BytesIO(pdf),
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{name}-learning-report.pdf"'},
    )


@router.get('/users/{user_id}')
async def user_detail(user_id: str, _admin=Depends(get_current_admin)):
    try:
        oid = ObjectId(user_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail='Invalid user id') from exc

    db = get_db()
    user = await db.users.find_one({'_id': oid})
    if not user:
        raise HTTPException(status_code=404, detail='User not found')

    progress = await db.student_progress.find({'user_id': oid}).sort('created_at', DESCENDING).limit(100).to_list(None)
    tests = await db.test_results.find({'user_id': oid}).sort('created_at', DESCENDING).limit(100).to_list(None)
    chats = await db.chat_history.find({'user_id': oid}).sort('created_at', DESCENDING).limit(100).to_list(None)
    activity = await db.activity_log.find({'user_id': oid}).sort('created_at', DESCENDING).limit(150).to_list(None)

    return {
        'user': _user_public(user),
        'progress': [_serialize_doc(row) for row in progress],
        'tests': [_serialize_doc(row) for row in tests],
        'chats': [_serialize_doc(row) for row in chats],
        'activity': [_serialize_doc(row) for row in activity],
    }


@router.get('/activity')
async def recent_activity(
    limit: int = Query(50, ge=1, le=200),
    _admin=Depends(get_current_admin),
):
    db = get_db()
    events = await db.activity_log.find().sort('created_at', DESCENDING).limit(limit).to_list(None)
    user_ids = list({event['user_id'] for event in events if event.get('user_id')})
    users = await db.users.find({'_id': {'$in': user_ids}}).to_list(None) if user_ids else []
    users_by_id = {str(user['_id']): user for user in users}

    result = []
    for event in events:
        uid = str(event.get('user_id'))
        user = users_by_id.get(uid, {})
        if user.get('role', 'student') == 'admin':
            continue
        row = _serialize_doc(event, remove_user_id=False)
        row['user_id'] = uid
        row['user'] = {
            'name': user.get('profile', {}).get('name') or user.get('email', 'Unknown user'),
            'email': user.get('email', ''),
        }
        result.append(row)
    return result
