FROM python:3.13-slim
WORKDIR /app
COPY pyproject.toml ./
COPY app ./app
COPY seed ./seed
RUN pip install --no-cache-dir .
COPY alembic.ini ./
COPY alembic ./alembic
EXPOSE 8000
CMD ["sh", "-c", "python -m alembic upgrade head && python -m seed.bootstrap && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
