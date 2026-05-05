include .env
export

.PHONY: setup dev dev-frontend dev-hmr dev-pwa dev-pwa-hmr dev-pwa-hmr-kapso dev-docker-hmr dev-docker-pwa-hmr dev-docker-pwa-hmr-kapso stop build migrate seed format lint test clean logs backend-shell db-studio gcloud-auth deploy-setup deploy-secrets-sync deploy-trigger-setup deploy-trigger-list deploy-backend deploy-verify deploy-frontend kapso-templates-sync kapso-webhook-tunnel query query-write backfill-thumbnails

setup:
	@bash scripts/setup.sh

dev:
	@bash scripts/log.sh MAKE "🚀" "Starting PropOS dev environment"
	@bash scripts/check_env.sh
	docker-compose up --build

dev-frontend:
	@bash scripts/log.sh MAKE "⚡" "Starting Vite dev (HMR, no service worker)"
	@LAN_IP=$$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "<your-mac-ip>"); \
		bash scripts/log.sh MAKE "📱" "iPhone same Wi-Fi: http://$$LAN_IP:5173"
	cd frontend && npm run dev -- --host 0.0.0.0 --port 5173

dev-pwa:
	@bash scripts/log.sh MAKE "📦" "Building frontend with PWA service worker"
	cd frontend && npm run build
	@LAN_IP=$$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "<your-mac-ip>"); \
		bash scripts/log.sh MAKE "📱" "iPhone same Wi-Fi: http://$$LAN_IP:4173 (installable PWA)"
	cd frontend && npm run preview -- --host 0.0.0.0 --port 4173

dev-hmr:
	@bash scripts/dev_hmr.sh

dev-pwa-hmr:
	@PWA=1 bash scripts/dev_hmr.sh

# Same as dev-pwa-hmr plus cloudflared tunnel for Kapso WhatsApp webhook.
dev-pwa-hmr-kapso:
	@PWA=1 KAPSO=1 bash scripts/dev_hmr.sh

# Docker variant: runs api+frontend in containers (avoids Tahoe Node bug),
# host runs only the HTTPS proxy on :5443 for HMR + iPhone LAN access.
dev-docker-hmr:
	@bash scripts/dev_docker_hmr.sh

dev-docker-pwa-hmr:
	@PWA=1 bash scripts/dev_docker_hmr.sh

# Same as dev-docker-pwa-hmr plus cloudflared tunnel for Kapso WhatsApp webhook.
dev-docker-pwa-hmr-kapso:
	@PWA=1 KAPSO=1 bash scripts/dev_docker_hmr.sh

stop:
	docker-compose down

migrate:
	@bash scripts/log.sh MAKE "🔄" "Running Supabase migrations (pooler URL)"
	@set -a; . ./.env; set +a; \
		if [ -z "$$SUPABASE_DB_PASSWORD" ]; then echo "ERROR: SUPABASE_DB_PASSWORD not in .env" && exit 1; fi; \
		POOLER_URL=$$(cat supabase/.temp/pooler-url 2>/dev/null); \
		if [ -z "$$POOLER_URL" ]; then echo "ERROR: supabase/.temp/pooler-url missing — run 'supabase link' first" && exit 1; fi; \
		ENC_PASS=$$(python3 -c "import urllib.parse,os;print(urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe=''))"); \
		DB_URL=$$(echo "$$POOLER_URL" | sed "s|@|:$$ENC_PASS@|"); \
		supabase db push --db-url "$$DB_URL" --yes

seed:
	@bash scripts/log.sh MAKE "📝" "Seeding dev data"
	supabase db reset

define python-preformat
	cd backend && poetry run python scripts/format/remove_inline_comments.py
	cd backend && poetry run python scripts/format/remove_double_blanks.py
endef

format:
	@bash scripts/log.sh MAKE "✨" "Auto-fix formatting (Python + JS/TS)"
	$(python-preformat)
	cd backend && poetry run ruff check --fix .
	cd backend && poetry run ruff format .
	cd frontend && npx eslint src --fix --report-unused-disable-directives --max-warnings 0
	cd frontend && npm run format

lint:
	@bash scripts/log.sh MAKE "🔍" "Check formatting (read-only)"
	cd backend && poetry run ruff check .
	cd backend && poetry run ruff format --check .
	cd frontend && npm run lint
	cd frontend && npx prettier --check "src/**/*.{ts,tsx}"

test:
	@bash scripts/log.sh MAKE "🧪" "Running test suites"
	cd backend && poetry run pytest
	cd frontend && npm run test

.ANITA_ENV := set -a && . ./.env && set +a && export ALLOWED_ORIGINS='["http://localhost:5173"]'

test-anita:
	@bash scripts/log.sh MAKE "🤖" "Anita LLM matrix (cerebras + groq, cached transcripts)"
	cd backend && rm -f tests/integration/anita/results.jsonl
	$(.ANITA_ENV) && cd backend && poetry run pytest tests/integration/anita -m 'integration and not whisper' --no-cov -v

test-anita-whisper:
	@bash scripts/log.sh MAKE "🎙" "Anita Whisper quality (rate-limited)"
	$(.ANITA_ENV) && cd backend && poetry run pytest tests/integration/anita -m 'integration and whisper' --no-cov -v

test-anita-full:
	@bash scripts/log.sh MAKE "🤖" "Anita full matrix (LLM + Whisper, all 4 providers)"
	cd backend && rm -f tests/integration/anita/results.jsonl
	$(.ANITA_ENV) && ANITA_TEST_FULL=1 cd backend && poetry run pytest tests/integration/anita -m integration --no-cov -v

test-anita-cache-refresh:
	@bash scripts/log.sh MAKE "🔄" "Re-transcribe all audios (Whisper, ~80s)"
	$(.ANITA_ENV) && cd backend && poetry run python scripts/anita_refresh_cache.py

# Try Anita on an arbitrary audio path or typed prompt.
#   make anita-try AUDIO=/abs/path/to.mp3
#   make anita-try TEXT="anota visita con Juan en Apoquindo, 30 min"
#   make anita-try AUDIO=foo.mp3 TENANT=<uuid>   # use existing tenant
#   make anita-try TEXT=... KEEP=1                # leave seed in DB
anita-try:
	@bash scripts/log.sh MAKE "🎯" "Anita one-shot try"
	@if [ -z "$(AUDIO)" ] && [ -z "$(TEXT)" ]; then echo "ERROR: pass AUDIO=<path> or TEXT=\"<prompt>\"" && exit 1; fi
	@AUDIO_ABS=""; if [ -n "$(AUDIO)" ]; then AUDIO_ABS=$$(python3 -c "import os,sys;print(os.path.abspath(sys.argv[1]))" "$(AUDIO)"); fi; \
	$(.ANITA_ENV); export SUPABASE_DB_SCHEMA=propos_test; cd backend; \
	args=""; \
	if [ -n "$$AUDIO_ABS" ]; then set -- "$$@" --audio "$$AUDIO_ABS"; fi; \
	if [ -n "$(TEXT)" ]; then set -- "$$@" --text "$(TEXT)"; fi; \
	if [ -n "$(TENANT)" ]; then set -- "$$@" --tenant "$(TENANT)"; fi; \
	if [ -n "$(KEEP)" ]; then set -- "$$@" --keep; fi; \
	poetry run python -m scripts.anita_try "$$@"

test-anita-report:
	cd backend && poetry run python scripts/anita_results_report.py

# Scanner pipeline visual harness.
# Drop photos into backend/tests/integration/scanner/fixtures/<doc-name>/0.jpg, 1.jpg, ...
# (HEIC, JPG, PNG, WebP all accepted). Run this; PDFs land in output/ (overwritten).
test-scanner:
	@bash scripts/log.sh MAKE "📄" "Scanner pipeline (folders → PDFs)"
	@cd backend && (poetry run python -c "import cv2, pillow_heif, reportlab" 2>/dev/null || \
		(echo "Installing scanner-harness deps..." && \
		 poetry run pip install opencv-python pillow pillow-heif reportlab numpy))
	cd backend && poetry run python tests/integration/scanner/run_scanner.py

test-docscanner:
	@bash scripts/log.sh MAKE "🧠" "DocScanner DL pipeline (folders → PDFs)"
	@cd backend && (poetry run python -c "import torch, skimage, gdown" 2>/dev/null || \
		(echo "Installing docscanner-harness deps..." && \
		 poetry run pip install torch torchvision scikit-image gdown))
	@if [ ! -f backend/tests/integration/scanner/docscanner/model_pretrained/DocScanner-L.pth ]; then \
		echo "Downloading pretrained models from Google Drive..." && \
		cd backend && poetry run gdown --folder \
		  https://drive.google.com/drive/folders/1W1_DJU8dfEh6FqDYqFQ7ypR38Z8c5r4D \
		  -O tests/integration/scanner/docscanner/model_pretrained; \
	fi
	cd backend && poetry run python tests/integration/scanner/run_docscanner.py

clean:
	docker-compose down -v
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type d -name .pytest_cache -exec rm -rf {} +
	find . -name "*.pyc" -delete

logs:
	docker-compose logs -f

backend-shell:
	docker-compose exec api poetry run bash

db-studio:
	supabase studio

# ============ DEPLOY ============
# Flow primera vez:
#   make deploy-setup           # APIs + Artifact Registry + IAM
#   make deploy-secrets-sync    # .env -> Secret Manager + cloudrun-env.yaml
#   make deploy-trigger-setup   # imprime URL pa crear trigger en UI (browser)
#   make deploy-backend         # primer deploy manual (sanity check)
# Día a día: git push origin main (auto-deploy si tocó backend/** o config/docker/**)

gcloud-auth:
	@ACTIVE=$$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null); \
	if [ -z "$$ACTIVE" ]; then \
		bash scripts/log.sh DEPLOY "🔑" "Authenticating with Google Cloud"; \
		gcloud auth login; \
	fi
	@gcloud config set project $(GCP_PROJECT_ID) 2>/dev/null

deploy-setup: gcloud-auth
	@bash scripts/log.sh DEPLOY "🔧" "Enabling APIs"
	gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
	@bash scripts/log.sh DEPLOY "📦" "Creating Artifact Registry repo (idempotente)"
	gcloud artifacts repositories create propos --repository-format=docker --location=$(GCP_REGION) || true
	@bash scripts/log.sh DEPLOY "🔑" "Granting Cloud Build SA roles"
	@PROJECT_NUM=$$(gcloud projects describe $(GCP_PROJECT_ID) --format='value(projectNumber)'); \
		SA="$$PROJECT_NUM-compute@developer.gserviceaccount.com"; \
		for role in run.admin iam.serviceAccountUser artifactregistry.writer secretmanager.secretAccessor; do \
			gcloud projects add-iam-policy-binding $(GCP_PROJECT_ID) \
				--member="serviceAccount:$$SA" \
				--role="roles/$$role" \
				--condition=None >/dev/null; \
		done
	@bash scripts/log.sh DEPLOY "✅" "GCP project bootstrap done"

deploy-secrets-sync: gcloud-auth
	@bash scripts/log.sh DEPLOY "🔐" "Syncing .env -> Secret Manager + cloudrun-env.yaml"
	@bash scripts/sync_cloud_env.sh

deploy-trigger-setup: gcloud-auth
	@bash scripts/log.sh DEPLOY "🔗" "Crea trigger en UI (legacy GitHub app no soporta CLI sin installation_id):"
	@echo "  https://console.cloud.google.com/cloud-build/triggers/add?project=$(GCP_PROJECT_ID)"
	@echo ""
	@echo "  Config:"
	@echo "    Name:          propos-api-deploy"
	@echo "    Event:         Push to a branch"
	@echo "    Repository:    vicenteaguero/PropOS"
	@echo "    Branch:        ^main\$$"
	@echo "    Config file:   config/docker/cloudbuild.yaml"
	@echo "    Included:      backend/**, config/docker/**"

deploy-trigger-list: gcloud-auth
	@gcloud builds triggers list --region=$(GCP_REGION) --format='table(name,github.owner,github.name,github.push.branch)'

deploy-backend: gcloud-auth
	@bash scripts/log.sh DEPLOY "🚀" "Manual build + deploy (bypass trigger)"
	gcloud builds submit --config config/docker/cloudbuild.yaml .
	@bash scripts/log.sh DEPLOY "✅" "Deployed. URL:"
	@gcloud run services describe propos-api --region $(GCP_REGION) --format='value(status.url)'

deploy-verify:
	@bash scripts/log.sh DEPLOY "🔍" "Health check"
	@URL=$$(gcloud run services describe propos-api --region $(GCP_REGION) --format='value(status.url)' 2>/dev/null); \
		if [ -z "$$URL" ]; then echo "service not deployed yet" && exit 1; fi; \
		curl -sf "$$URL/health" && echo "" || echo "FAIL"

deploy-frontend:
	@bash scripts/log.sh DEPLOY "🚀" "Deploying frontend to Vercel"
	cd frontend && npx vercel --prod

kapso-templates-sync:
	@bash scripts/log.sh KAPSO "📨" "Syncing WhatsApp HSM templates to Kapso"
	cd backend && poetry run python -m scripts.kapso_templates_sync

kapso-webhook-tunnel:
	@bash scripts/log.sh KAPSO "🌐" "cloudflared → http://localhost:8000 (set Kapso webhook to printed URL + /api/v1/integrations/kapso/webhook)"
	cloudflared tunnel --url http://localhost:8000

# Run SQL against Supabase pooler (read-only by default).
#   make query SQL="select * from kapso_webhook_events order by received_at desc limit 5"
#   make query SQL=path/to/query.sql
#   make query-write SQL="update client_conversations set status='closed' where id='...'"
query:
	@if [ -z "$(SQL)" ]; then echo "usage: make query SQL=\"<sql>\" | path/to.sql" && exit 1; fi
	cd backend && poetry run python -m scripts.db_query "$(SQL)"

query-write:
	@if [ -z "$(SQL)" ]; then echo "usage: make query-write SQL=\"<sql>\"" && exit 1; fi
	cd backend && poetry run python -m scripts.db_query --write "$(SQL)"

# Backfill missing thumbnails for document_versions (PDFs + images).
#   make backfill-thumbnails ARGS="--dry-run --limit 10"
#   make backfill-thumbnails ARGS="--mime image"
backfill-thumbnails:
	cd backend && poetry run python -m scripts.backfill_thumbnails $(ARGS)
