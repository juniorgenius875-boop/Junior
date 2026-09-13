import asyncio
import json
import re
from typing import Any
from google import genai
from ..config import settings


class RAGNotConfiguredError(RuntimeError):
    pass


class RAGService:
    def __init__(self):
        self.client = genai.Client(api_key=settings.gemini_api_key) if settings.gemini_api_key else None
        self.model = settings.gemini_model
        self.store_name = settings.gemini_file_search_store

    @property
    def ready(self) -> bool:
        return bool(self.client and self.store_name)

    def _ensure_ready(self):
        if not self.client:
            raise RAGNotConfiguredError('GEMINI_API_KEY is not configured')
        if not self.store_name:
            raise RAGNotConfiguredError(
                'GEMINI_FILE_SEARCH_STORE is not configured. Run scripts/rag_ingest.py and set the returned store name.'
            )

    @staticmethod
    def _clean_json(text: str) -> Any:
        cleaned = text.strip()
        cleaned = re.sub(r'^```(?:json)?\s*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\s*```$', '', cleaned)
        return json.loads(cleaned)

    def _query_sync(self, prompt: str) -> dict:
        self._ensure_ready()
        interaction = self.client.interactions.create(
            model=self.model,
            input=prompt,
            tools=[{
                'type': 'file_search',
                'file_search_store_names': [self.store_name],
            }],
        )

        text_parts: list[str] = []
        sources: list[dict] = []
        seen_sources: set[tuple[str, str]] = set()

        for step in getattr(interaction, 'steps', []) or []:
            if getattr(step, 'type', None) != 'model_output':
                continue
            for block in getattr(step, 'content', []) or []:
                if getattr(block, 'type', None) == 'text' and getattr(block, 'text', None):
                    text_parts.append(block.text)
                for annotation in getattr(block, 'annotations', []) or []:
                    if getattr(annotation, 'type', None) != 'file_citation':
                        continue
                    file_name = getattr(annotation, 'file_name', '') or ''
                    source = getattr(annotation, 'source', '') or ''
                    key = (file_name, source)
                    if key not in seen_sources:
                        seen_sources.add(key)
                        sources.append({'file_name': file_name, 'source': source})

        text = '\n'.join(text_parts).strip()
        if not text:
            raise RuntimeError('Gemini RAG returned an empty response')
        return {'text': text, 'sources': sources}

    async def query(self, prompt: str, expect_json: bool = False) -> dict:
        result = await asyncio.to_thread(self._query_sync, prompt)
        if expect_json:
            return {'data': self._clean_json(result['text']), 'sources': result['sources']}
        return result


rag_service = RAGService()
