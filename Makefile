PYTHON ?= python3
BACKEND_PYTHON := .venv/bin/python
TEST_DATABASE_URL ?= postgresql+asyncpg://college:college@localhost:$(or $(POSTGRES_PORT),5432)/college_finder_test

.PHONY: setup db migrate seed seed-demo review-pilot apply-pilot review-batch apply-batch review-directory apply-directory api web test test-db web-test preview lint build

setup:
	$(PYTHON) -m venv backend/.venv
	cd backend && $(BACKEND_PYTHON) -m pip install -e '.[dev]'
	cd frontend && npm ci
	@echo "Copy backend/.env.example to backend/.env and set JWT_SECRET before starting the API."

db:
	docker compose up -d --wait postgres

migrate:
	cd backend && $(BACKEND_PYTHON) -m alembic upgrade head

seed:
	cd backend && $(BACKEND_PYTHON) -m seed.seed

seed-demo:
	cd backend && $(BACKEND_PYTHON) -m seed.seed --demo-user

review-pilot:
	cd backend && $(BACKEND_PYTHON) -m seed.review seed/data/reviewed_iit_bombay_2026.json --evidence-dir seed/evidence

apply-pilot:
	cd backend && $(BACKEND_PYTHON) -m seed.review seed/data/reviewed_iit_bombay_2026.json --evidence-dir seed/evidence --apply

review-batch:
	cd backend && $(BACKEND_PYTHON) -m seed.review seed/data/reviewed_iits_2026.json --evidence-dir seed/evidence

apply-batch:
	cd backend && $(BACKEND_PYTHON) -m seed.review seed/data/reviewed_iits_2026.json --evidence-dir seed/evidence --apply

review-directory:
	cd backend && $(BACKEND_PYTHON) -m seed.review seed/data/reviewed_directory_2026.json --evidence-dir seed/evidence

apply-directory:
	cd backend && $(BACKEND_PYTHON) -m seed.review seed/data/reviewed_directory_2026.json --evidence-dir seed/evidence --apply

api:
	cd backend && $(BACKEND_PYTHON) -m uvicorn app.main:app --reload --port 8000

web:
	cd frontend && npm run dev

test-db: db
	docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U college -d postgres < backend/tests/create_database.sql

test: test-db
	cd backend && TEST_DATABASE_URL="$(TEST_DATABASE_URL)" $(BACKEND_PYTHON) -m pytest

web-test:
	cd frontend && npm run test

preview:
	cd frontend && npm run build:preview

lint:
	cd backend && $(BACKEND_PYTHON) -m ruff check .
	cd frontend && npm run lint

build:
	cd frontend && npm run build
