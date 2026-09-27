import asyncio
from dataclasses import dataclass

import httpx
from google import genai
from google.genai import types

from ..config import settings


@dataclass(frozen=True)
class AgentResult:
    text: str
    provider: str
    model: str


class OpenAICompatibleAgent:
    def __init__(
        self,
        *,
        provider: str,
        api_key: str | None,
        base_url: str,
        model: str,
        timeout_seconds: float,
        extra_headers: dict | None = None,
    ):
        self.provider = provider
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.model = model
        self.timeout_seconds = timeout_seconds
        self.extra_headers = extra_headers or {}

    @property
    def ready(self) -> bool:
        return bool(self.api_key)

    async def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int = 650,
    ) -> AgentResult:
        if not self.api_key:
            raise RuntimeError(f'{self.provider} API key is not configured')

        payload = {
            'model': self.model,
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt},
            ],
            'temperature': 0.25,
        }
        # Groq follows OpenAI chat-completions and prefers max_completion_tokens.
        # OpenRouter supports max_tokens across the broadest set of routed free models.
        if self.provider == 'groq':
            payload['max_completion_tokens'] = max_output_tokens
            if self.model.startswith('openai/gpt-oss-'):
                payload['reasoning_effort'] = 'low'
        else:
            payload['max_tokens'] = max_output_tokens

        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            **self.extra_headers,
        }
        timeout = httpx.Timeout(self.timeout_seconds, connect=min(5.0, self.timeout_seconds))
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f'{self.base_url}/chat/completions',
                headers=headers,
                json=payload,
            )

        if response.status_code >= 400:
            detail = response.text[:600]
            raise RuntimeError(f'{self.provider} returned {response.status_code}: {detail}')

        data = response.json()
        choices = data.get('choices') or []
        text = ''
        if choices:
            text = ((choices[0].get('message') or {}).get('content') or '').strip()
        if not text:
            raise RuntimeError(f'{self.provider} returned an empty response')

        return AgentResult(
            text=text,
            provider=self.provider,
            model=data.get('model') or self.model,
        )


class GeminiDirectAgent:
    def __init__(self):
        self.client = genai.Client(api_key=settings.gemini_api_key) if settings.gemini_api_key else None
        self.model = settings.gemini_model
        self.timeout_seconds = settings.gemini_direct_timeout_seconds

    @property
    def ready(self) -> bool:
        return bool(self.client)

    def _generate_sync(self, system_prompt: str, user_prompt: str, max_output_tokens: int) -> AgentResult:
        if not self.client:
            raise RuntimeError('GEMINI_API_KEY is not configured')
        response = self.client.models.generate_content(
            model=self.model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=max_output_tokens,
                temperature=0.25,
            ),
        )
        text = (response.text or '').strip()
        if not text:
            raise RuntimeError('Gemini returned an empty response')
        return AgentResult(text=text, provider='gemini', model=self.model)

    async def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int = 650,
    ) -> AgentResult:
        if not self.client:
            raise RuntimeError('GEMINI_API_KEY is not configured')
        return await asyncio.wait_for(
            asyncio.to_thread(self._generate_sync, system_prompt, user_prompt, max_output_tokens),
            timeout=self.timeout_seconds,
        )


groq_agent = OpenAICompatibleAgent(
    provider='groq',
    api_key=settings.groq_api_key,
    base_url=settings.groq_base_url,
    model=settings.groq_model,
    timeout_seconds=settings.groq_timeout_seconds,
)

openrouter_agent = OpenAICompatibleAgent(
    provider='openrouter',
    api_key=settings.openrouter_api_key,
    base_url=settings.openrouter_base_url,
    model=settings.openrouter_model,
    timeout_seconds=settings.openrouter_timeout_seconds,
    extra_headers={
        'X-Title': settings.openrouter_app_name,
    },
)

gemini_direct_agent = GeminiDirectAgent()
