"""Promote or demote a Junior Genius account.

Usage:
  python scripts/set_admin.py admin@example.com
  python scripts/set_admin.py admin@example.com --student
"""
import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('email')
    parser.add_argument('--student', action='store_true', help='Demote the account back to student')
    args = parser.parse_args()

    uri = os.getenv('MONGODB_URI')
    db_name = os.getenv('MONGODB_DB', 'junior_genius')
    if not uri:
        print('MONGODB_URI is missing from student-backend/.env')
        sys.exit(1)

    role = 'student' if args.student else 'admin'
    client = MongoClient(uri)
    try:
        db = client[db_name]
        result = db.users.update_one(
            {'email': args.email.lower().strip()},
            {'$set': {'role': role}},
        )
        if result.matched_count == 0:
            print(f'No user found with email: {args.email}')
            sys.exit(2)
        print(f'{args.email} is now role={role}')
    finally:
        client.close()


if __name__ == '__main__':
    main()
