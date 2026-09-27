import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel


@dataclass(frozen=True)
class RetrievedChunk:
    text: str
    chapter: str
    source_file: str
    score: float


class LocalRAGService:
    """Small in-process retriever for the consolidated NCERT corpus.

    This intentionally avoids a network vector/file-search round trip. The corpus is
    small enough that a TF-IDF index is both fast and deterministic for the current
    Grade 6 mathematics material.
    """

    def __init__(self):
        backend_root = Path(__file__).resolve().parents[2]
        configured = os.getenv(
            'LOCAL_RAG_FILE',
            'knowledge_fast/junior_genius_grade6_math_rag.md',
        )
        configured_path = Path(configured)
        self.corpus_path = configured_path if configured_path.is_absolute() else backend_root / configured_path
        self.max_chunk_chars = int(os.getenv('LOCAL_RAG_CHUNK_CHARS', '2200'))
        self.overlap_chars = int(os.getenv('LOCAL_RAG_OVERLAP_CHARS', '260'))
        self.default_top_k = int(os.getenv('LOCAL_RAG_TOP_K', '5'))

        self._chunks: list[dict] = []
        self._vectorizer: TfidfVectorizer | None = None
        self._matrix = None
        self._load()

    @property
    def ready(self) -> bool:
        return bool(self._chunks and self._vectorizer is not None and self._matrix is not None)

    def _load(self):
        if not self.corpus_path.exists():
            return

        text = self.corpus_path.read_text(encoding='utf-8', errors='ignore')
        self._chunks = self._build_chunks(text)
        if not self._chunks:
            return

        self._vectorizer = TfidfVectorizer(
            lowercase=True,
            stop_words='english',
            ngram_range=(1, 2),
            sublinear_tf=True,
            max_features=50000,
        )
        self._matrix = self._vectorizer.fit_transform(chunk['text'] for chunk in self._chunks)

    def _build_chunks(self, text: str) -> list[dict]:
        chapter_pattern = re.compile(r'(?m)^# Chapter\s+\d+\s+-\s+.+$')
        matches = list(chapter_pattern.finditer(text))
        if not matches:
            return self._split_section(text, 'Grade 6 Mathematics', '')

        chunks: list[dict] = []
        for index, match in enumerate(matches):
            start = match.start()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            section = text[start:end].strip()
            chapter = match.group(0).lstrip('#').strip()
            source_match = re.search(r'\*\*Source file:\*\*\s*`([^`]+)`', section)
            source_file = source_match.group(1) if source_match else ''
            chunks.extend(self._split_section(section, chapter, source_file))
        return chunks

    def _split_section(self, section: str, chapter: str, source_file: str) -> list[dict]:
        paragraphs = [part.strip() for part in re.split(r'\n\s*\n', section) if part.strip()]
        chunks: list[dict] = []
        current = ''

        def flush(value: str):
            value = value.strip()
            if value:
                chunks.append({'text': value, 'chapter': chapter, 'source_file': source_file})

        for paragraph in paragraphs:
            candidate = f'{current}\n\n{paragraph}'.strip() if current else paragraph
            if len(candidate) <= self.max_chunk_chars:
                current = candidate
                continue

            flush(current)
            if len(paragraph) <= self.max_chunk_chars:
                tail = current[-self.overlap_chars:] if current else ''
                current = f'{tail}\n\n{paragraph}'.strip() if tail else paragraph
            else:
                step = max(400, self.max_chunk_chars - self.overlap_chars)
                for pos in range(0, len(paragraph), step):
                    piece = paragraph[pos:pos + self.max_chunk_chars]
                    flush(piece)
                current = ''

        flush(current)
        return chunks

    def retrieve(self, query: str, top_k: int | None = None, min_score: float = 0.02) -> list[RetrievedChunk]:
        if not self.ready or not query.strip():
            return []

        query_vector = self._vectorizer.transform([query])
        scores = linear_kernel(query_vector, self._matrix).ravel()
        if not np.any(scores > 0):
            return []

        k = max(1, min(top_k or self.default_top_k, len(scores)))
        best_indexes = np.argpartition(scores, -k)[-k:]
        best_indexes = best_indexes[np.argsort(scores[best_indexes])[::-1]]

        results: list[RetrievedChunk] = []
        for idx in best_indexes:
            score = float(scores[idx])
            if score < min_score:
                continue
            chunk = self._chunks[int(idx)]
            results.append(RetrievedChunk(
                text=chunk['text'],
                chapter=chunk['chapter'],
                source_file=chunk['source_file'],
                score=score,
            ))
        return results

    @staticmethod
    def format_context(chunks: Iterable[RetrievedChunk], max_chars: int = 9000) -> str:
        blocks: list[str] = []
        total = 0
        for item in chunks:
            header = f'[{item.chapter}' + (f' | {item.source_file}' if item.source_file else '') + ']'
            block = f'{header}\n{item.text.strip()}'
            if total + len(block) > max_chars:
                remaining = max_chars - total
                if remaining > 300:
                    blocks.append(block[:remaining])
                break
            blocks.append(block)
            total += len(block)
        return '\n\n---\n\n'.join(blocks)


local_rag_service = LocalRAGService()
