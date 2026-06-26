SHELL := /bin/bash

BACKEND_DIR := $(CURDIR)/src/backend
FRONTEND_DIR := $(CURDIR)/src/frontend
MINIAPP_DIR := $(CURDIR)/src/telegram-miniapp
BOT_DIR := $(CURDIR)/src/telegram-bot
CERTS_DIR := $(BACKEND_DIR)/certs
JWT_PRIVATE_KEY := $(CERTS_DIR)/jwt-private.pem
JWT_PUBLIC_KEY := $(CERTS_DIR)/jwt-public.pem

.PHONY: help sync lint test openapi keys certs build up down stop logs run seed tg backup restore

help:
	@echo " "
	@echo "Targets:"
	@echo "  seed            - Seed demo users, restaurants and menu items into the database"
	@echo "  sync            - Sync locally project dependencies with UV"
	@echo "  lint            - Run all project code linting"
	@echo "  test            - Run all project tests"
	@echo "  openapi         - Export OpenAPI schema and generate typed frontend clients"
	@echo "  keys, certs     - Generate RSA keys for JWT auth (use FORCE=1 to overwrite)"
	@echo "  tg              - Start local Telegram bot testing through ngrok"
	@echo " "
	@echo "  build           - Build docker containers (use SERVICE=... to build a specific service)"
	@echo "  up              - Start containers (use SERVICE=... to start a specific service)"
	@echo "  down            - Stop and remove containers (use SERVICE=... to stop and remove a specific service)"
	@echo "  stop            - Stop running containers (use SERVICE=... to stop a specific service)"
	@echo "  logs            - View containers logs (use SERVICE=... to specific containers logs and/or LOGS_TAIL=... to set logs length)"
	@echo " "
	@echo "  backup          - Backup PostgreSQL database (env: PG_CONTAINER, BACKUP_DIR, KEEP_LAST)"
	@echo "  restore FILE=.. - Restore PostgreSQL database from a .dump file"
	@echo " "

seed:
	docker compose exec -e PYTHONPATH=/backend backend python /tools/seed.py

tg:
	@bash tools/tg.sh

sync:
	cd "$(BACKEND_DIR)" && pip install uv && uv sync
	cd "$(BOT_DIR)" && pip install uv && uv sync
	cd "$(FRONTEND_DIR)" && npm install --silent
	cd "$(MINIAPP_DIR)" && npm install --silent
	@echo " "
	@echo "Dependencies synced!"

lint:
	cd "$(BACKEND_DIR)" && uv run pre-commit run --all-files
	cd "$(FRONTEND_DIR)" && npm run lint
	cd "$(MINIAPP_DIR)" && npm run lint
	@echo " "
	@echo "Linting completed!"

test:
	cd "$(BACKEND_DIR)" && uv run pytest
	cd "$(BOT_DIR)" && uv run pytest
	cd "$(FRONTEND_DIR)" && npm test -- --run
	cd "$(MINIAPP_DIR)" && npm test -- --run
	@echo " "
	@echo "Tests completed!"

openapi:
	cd "$(BACKEND_DIR)" && uv run python ../../tools/export_openapi.py --output "$(CURDIR)/openapi/foodize.openapi.json"
	cd "$(FRONTEND_DIR)" && npm run api:generate
	cd "$(MINIAPP_DIR)" && npm run api:generate
	@echo " "
	@echo "OpenAPI schema and typed clients generated!"

keys: certs

certs:
	@mkdir -p "$(CERTS_DIR)"
	@if [ -f "$(JWT_PRIVATE_KEY)" ] && [ -f "$(JWT_PUBLIC_KEY)" ] && [ "$(FORCE)" != "1" ]; then \
		echo "JWT keys already exist in $(CERTS_DIR). Use FORCE=1 to overwrite."; \
	else \
		openssl genrsa -out "$(JWT_PRIVATE_KEY)" 2048; \
		openssl rsa -in "$(JWT_PRIVATE_KEY)" -outform PEM -pubout -out "$(JWT_PUBLIC_KEY)"; \
		chmod 600 "$(JWT_PRIVATE_KEY)"; \
		chmod 644 "$(JWT_PUBLIC_KEY)"; \
		echo " "; \
		echo "JWT keys generated in $(CERTS_DIR)!"; \
		echo "Docker path: /backend/certs/jwt-private.pem"; \
	fi
	@echo " "

SERVICE ?=

build:
	@if [ -n "$(SERVICE)" ]; then \
		docker compose build $(SERVICE); \
	else \
		docker compose build; \
	fi
	@echo " "
	@echo "Build completed!"

up:
	@if [ -n "$(SERVICE)" ]; then \
		docker compose up -d --remove-orphans $(SERVICE); \
	else \
		docker compose up -d --remove-orphans; \
	fi
	@echo " "
	@echo "Containers started!"

down:
	@if [ -n "$(SERVICE)" ]; then \
		docker compose stop $(SERVICE) || true; \
		docker compose rm -f $(SERVICE) || true; \
	else \
		docker compose down; \
	fi
	@echo " "
	@echo "Containers stopped and removed!"

stop:
	@if [ -n "$(SERVICE)" ]; then \
		docker compose stop $(SERVICE); \
	else \
		docker compose stop; \
	fi
	@echo " "
	@echo "Containers stopped!"

LOGS_TAIL ?=

logs:
	@if [ -n "$(SERVICE)" ] && [ -n "$(LOGS_TAIL)" ]; then \
		echo "Showing last $(LOGS_TAIL) lines from service: $(SERVICE)"; \
		docker compose logs -f --tail=$(LOGS_TAIL) $(SERVICE); \
	elif [ -n "$(SERVICE)" ]; then \
		echo "Following logs from service: $(SERVICE)"; \
		docker compose logs -f $(SERVICE); \
	elif [ -n "$(LOGS_TAIL)" ]; then \
		echo "Showing last $(LOGS_TAIL) lines from all services"; \
		docker compose logs -f --tail=$(LOGS_TAIL); \
	else \
		echo "Following logs from all services"; \
		docker compose logs -f; \
	fi

FILE ?=

backup:
	@bash tools/backup.sh

restore:
	@bash tools/restore.sh "$(FILE)"
