# QUICK

Quick — платформа предзаказа еды, которая связывает покупателей с локальными
ресторанами. Покупатели собирают заказ и выбирают время самовывоза, рестораны
управляют меню и обрабатывают заказы. Доступ есть из веб-приложения, Telegram
Mini App и через Telegram-бота. В платформу встроены два диалоговых ИИ-агента:
помощник по оформлению заказа для покупателя и ИИ-аналитик бизнеса для владельца
точки.

## Возможности

**Покупатели**
- Каталог ресторанов и меню, корзина, заказы с временем самовывоза.
- Опции и модификаторы блюд, промокоды, избранное, отзывы и рейтинги.
- Push-уведомления о статусе заказа (WebSocket + Telegram).
- **ИИ-помощник заказа** — находит блюда и оформляет заказ в чате.

**Рестораны / вендоры**
- Управление меню (позиции, категории, опции, доступность).
- Лента входящих заказов в реальном времени, управление статусами.
- Финансовая аналитика и продвинутая статистика, экспорт (CSV / PDF).
- Управление персоналом и его правами.
- **ИИ-аналитик бизнеса** — разбор продаж и рекомендации в чате.

**Персонал и админы**
- Роль персонала с экраном выдачи заказов (display board).
- Админ-панель: модерация ресторанов и вендоров, пользователи, права (RBAC),
  статистика платформы, экспорты, аудит действий.

**Telegram**
- Mini App с авторизацией через `initData`.
- Бот (aiogram): привязка аккаунта по номеру телефона, уведомления о заказах.

## ИИ-ассистенты

Два агента под разные роли, оба отвечают стримингом (токен за токеном):

| Агент | Для кого | Что делает |
|---|---|---|
| **Order Agent** | покупатель | находит блюда (RAG-поиск по меню), собирает корзину и оформляет заказ — через инструменты, с подтверждением перед оформлением |
| **Business Advisor** | владелец точки | анализирует продажи, пиковые часы, топ/антитоп позиции, выручку по категориям и отзывы, даёт конкретные рекомендации; есть проактивный разбор с кэшем на 24 часа |

**Провайдер-агностичный слой LLM.** Один контракт — несколько провайдеров,
переключение одной переменной окружения (`LLM__PROVIDER`), код агентов не меняется:

- Anthropic (Claude) — прямая интеграция;
- GigaChat (Сбер) и OpenAI / OpenRouter — через OpenAI-совместимый эндпоинт;
- Ollama — локальный инференс.

**Tool-calling.** Единый цикл агента ([`infra/llm/agent.py`](src/backend/infra/llm/agent.py))
исполняет вызовы инструментов (function calling) на сервере: модель передаёт только
идентификаторы и параметры, а цены, наличие и права (`user_id` / `vendor_id`)
проверяются на бэкенде — модель не обращается к БД напрямую.

**RAG-поиск по меню** ([`ai_order_agent/search.py`](src/backend/features/ai_order_agent/search.py)):
SQL-префильтр доступных позиций → эмбеддинги запроса и кандидатов (bge-m3) →
косинусная близость → гибридный ре-ранк → top-k, с кэшем эмбеддингов в Redis.
Если эмбеддинги недоступны — автоматический фолбэк на keyword-поиск.

**Prompt engineering.** Системные промпты и сценарии заданы в `service.py` каждого
агента: правила, формат ответа, обязательное подтверждение перед оформлением заказа,
обработка пустого результата, защита входа (whitelist ролей сообщений, лимиты длины
и истории).

Код: [`infra/llm/`](src/backend/infra/llm/),
[`features/ai_order_agent/`](src/backend/features/ai_order_agent/),
[`features/ai_advisor/`](src/backend/features/ai_advisor/);
конфигурация — [`settings/config/runtime/llm.py`](src/backend/settings/config/runtime/llm.py);
тесты — [`tests/unit/ai/`](src/backend/tests/unit/ai/).

## Технологический стек

- **ИИ:** провайдер-агностичный LLM-слой (Anthropic / GigaChat / OpenAI-совместимые /
  Ollama), function calling, RAG (эмбеддинги + Redis-кэш), prompt engineering.
- **Backend:** Python, FastAPI, SQLAlchemy (async), Alembic, PostgreSQL, Redis, RabbitMQ.
- **Frontend:** React, Vite, Zustand, Axios.
- **Telegram:** Mini App (React + WebApp SDK), бот (aiogram).
- **Инфраструктура:** Docker Compose, Prometheus, Grafana; CI с ruff, mypy, pytest, vitest.

## Архитектура

- Бэкенд организован по фичам: `src/backend/features/*`; инфраструктурные слои —
  `src/backend/infra/*` (`llm`, `cache`, `messaging`).
- Аутентификация на JWT (RSA-ключи), ролевая модель прав (RBAC).
- Реалтайм (заказы, уведомления, display board) — через WebSocket.
- Надёжная доставка событий через **Outbox** (таблица `outbox_events` + воркер),
  чтобы не терять уведомления при недоступности брокера.
- Идемпотентность создания заказа по заголовку `Idempotency-Key`.
- Бэкенд — источник правды по API-контракту; типизированные клиенты для веба и
  Mini App генерируются из OpenAPI (`make openapi`).

## Быстрый старт (Docker)

```bash
cp .env.example .env   # заполнить значения (как минимум LLM-провайдер, см. ниже)
make keys              # RSA-ключи для JWT → src/backend/certs
make up                # поднять весь стек
make seed              # засеять демо-данные (рестораны, меню, пользователи)
```

Локальные сервисы:

- Backend API + Swagger: `http://localhost:8000/docs`
- Healthcheck: `http://localhost:8000/api/health`
- Frontend: `http://localhost:5173`
- Telegram Mini App (dev): `http://localhost:5174`
- RabbitMQ UI: `http://localhost:15672`

### Настройка LLM в `.env`

```env
# Выберите ОДНОГО провайдера
LLM__PROVIDER=openai
LLM__OPENAI_API_KEY=sk-or-...
LLM__OPENAI_BASE_URL=https://openrouter.ai/api/v1
LLM__OPENAI_MODEL=openai/gpt-4o-mini

# Anthropic:  LLM__PROVIDER=anthropic, LLM__ANTHROPIC_API_KEY=sk-ant-...
# GigaChat:   LLM__PROVIDER=gigachat,  LLM__GIGACHAT_API_KEY=<токен>
# Ollama:     LLM__PROVIDER=ollama,    LLM__OLLAMA_MODEL=qwen2.5

# Эмбеддинги для RAG-поиска (локальный Ollama bge-m3). Если недоступны —
# поиск автоматически деградирует в keyword-режим.
LLM__EMBEDDINGS_ENABLED=true
LLM__EMBEDDING_BASE_URL=http://localhost:11434/v1
LLM__EMBEDDING_MODEL=bge-m3
```

> Модель должна поддерживать tool calling (function calling) — на нём держатся оба агента.

Проверить агентов: Swagger на `http://localhost:8000/docs` →
`POST /api/v1/ai/order/chat` и `POST /api/v1/ai/advisor/chat`, либо кнопка ассистента
в веб-интерфейсе.

## Команды разработки

```bash
make sync      # установить зависимости (backend, bot, frontend, miniapp)
make lint      # ruff + black (backend, bot), eslint (frontend, miniapp)
make test      # pytest (backend, bot) + vitest (frontend, miniapp)
make openapi   # экспорт OpenAPI-схемы и генерация типизированных клиентов
make up / down / logs   # управление контейнерами
make seed      # демо-данные
```

Только бэкенд:

```bash
cd src/backend
uv run pytest
uv run ruff check .
uv run mypy .
uv run alembic upgrade head
```

## Telegram

Mini App авторизует пользователя через валидацию `initData` на бэкенде. Бот
привязывает Telegram к аккаунту Foodize по номеру телефона. Для локального теста с
публичным HTTPS используется `make tg` (поднимает сервисы и пробрасывает Mini App
через ngrok).

Необходимые значения в `.env`: `BOT_TOKEN`, `TELEGRAM__BOT_API_SECRET`,
`MINI_APP_URL`, `BOT_MODE=polling` (локально).

## Бэкап и мониторинг

```bash
make backup                 # дамп PostgreSQL
make restore FILE=dump.sql  # восстановление

docker compose -f docker-compose.monitoring.yml up -d   # Prometheus + Grafana
```

## Лицензия

MIT — см. [LICENSE](LICENSE).
