FROM python:3.13.0-bookworm AS base

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV UV_SYSTEM_PYTHON=1

RUN pip install --no-cache-dir uv==0.6.0

WORKDIR /bot

COPY pyproject.toml ./
RUN uv pip install --system --no-cache -r pyproject.toml

COPY . .

RUN useradd -m appuser
USER appuser

CMD ["python", "main.py"]
