FROM python:3.13.0-bookworm AS base

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV UV_SYSTEM_PYTHON=1

RUN pip install --no-cache-dir uv==0.6.0

WORKDIR /backend

RUN apt-get update && apt-get install -y netcat-openbsd fonts-dejavu-core && apt-get clean

COPY pyproject.toml uv.lock ./
RUN uv pip install --system --no-cache -r pyproject.toml

COPY . .

FROM base AS migrations
RUN useradd -m appuser
USER appuser
CMD ["alembic", "upgrade", "head"]

FROM base AS backend
RUN useradd -m appuser
USER appuser
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/backend"]

FROM base AS worker
RUN useradd -m appuser
USER appuser
CMD ["watchfiles", "python -m worker.main", "/backend"]
