from pymongo import ASCENDING, DESCENDING, AsyncMongoClient
from pymongo.server_api import ServerApi
from .config import settings

client: AsyncMongoClient | None = None
db = None


async def connect_db():
    global client, db
    client = AsyncMongoClient(settings.mongodb_uri, server_api=ServerApi('1'))
    db = client.get_database(settings.mongodb_db)
    await db.command('ping')

    await db.users.create_index([('email', ASCENDING)], unique=True)
    await db.student_progress.create_index([('user_id', ASCENDING), ('created_at', DESCENDING)])
    await db.test_results.create_index([('user_id', ASCENDING), ('created_at', DESCENDING)])
    await db.chat_history.create_index([('user_id', ASCENDING), ('created_at', DESCENDING)])
    await db.activity_log.create_index([('user_id', ASCENDING), ('created_at', DESCENDING)])
    await db.activity_log.create_index([('created_at', DESCENDING)])
    await db.users.create_index([('last_seen_at', DESCENDING)])


async def close_db():
    global client, db
    if client is not None:
        await client.close()
    client = None
    db = None


def get_db():
    if db is None:
        raise RuntimeError('MongoDB is not connected')
    return db
