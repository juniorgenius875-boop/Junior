"""Create/reuse a Gemini File Search store and ingest curriculum files.

Usage:
    python scripts/rag_ingest.py knowledge

After the first run, copy the printed store name into:
    GEMINI_FILE_SEARCH_STORE=fileSearchStores/...
"""
import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv
from google import genai

load_dotenv()

SUPPORTED = {'.txt', '.md', '.pdf', '.doc', '.docx', '.csv', '.html', '.htm'}


def main():
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise SystemExit('GEMINI_API_KEY is required')

    root = Path(sys.argv[1] if len(sys.argv) > 1 else 'knowledge').resolve()
    if not root.exists():
        raise SystemExit(f'Knowledge directory not found: {root}')

    files = [p for p in root.rglob('*') if p.is_file() and p.suffix.lower() in SUPPORTED]
    if not files:
        raise SystemExit(f'No supported knowledge files found under {root}')

    client = genai.Client(api_key=api_key)
    store_name = os.getenv('GEMINI_FILE_SEARCH_STORE')
    if store_name:
        store = client.file_search_stores.get(name=store_name)
        print(f'Using existing store: {store.name}')
    else:
        store = client.file_search_stores.create(
            config={
                'display_name': os.getenv('GEMINI_FILE_SEARCH_DISPLAY_NAME', 'junior-genius-curriculum'),
                'embedding_model': 'models/gemini-embedding-2',
            }
        )
        print(f'Created store: {store.name}')

    for path in files:
        print(f'Uploading: {path.relative_to(root)}')
        operation = client.file_search_stores.upload_to_file_search_store(
            file=str(path),
            file_search_store_name=store.name,
            config={
                'display_name': str(path.relative_to(root)),
                'chunking_config': {
                    'white_space_config': {
                        'max_tokens_per_chunk': 500,
                        'max_overlap_tokens': 75,
                    }
                },
            },
        )
        while not operation.done:
            time.sleep(2)
            operation = client.operations.get(operation)

    print('\nRAG ingestion complete.')
    print(f'GEMINI_FILE_SEARCH_STORE={store.name}')


if __name__ == '__main__':
    main()
