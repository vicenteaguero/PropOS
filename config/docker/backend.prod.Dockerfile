FROM python:3.12-slim AS builder
WORKDIR /app

RUN pip install --no-cache-dir poetry poetry-plugin-export
COPY backend/pyproject.toml backend/poetry.lock* ./
RUN python -m venv /opt/venv \
    && poetry export --without dev --format requirements.txt --output requirements.txt --without-hashes \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
COPY backend/ .
RUN find /app -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
