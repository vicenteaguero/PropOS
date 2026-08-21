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
    PYTHONUNBUFFERED=1
COPY backend/ .
# Compile to bytecode at build time, not at every boot.
#
# This image used to set PYTHONDONTWRITEBYTECODE=1 AND delete __pycache__, so a
# cold start recompiled all 255 application modules plus every dependency, in
# the request path — Cloud Run runs with --min-instances=0, so a user pays for
# that. Shipping the .pyc files costs a few MB of layer and buys the whole
# compile step back. `|| true` because compileall exits non-zero on a single
# unimportable file, and a vendored sample that never runs must not fail a
# build.
RUN python -m compileall -q /app /opt/venv || true
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
