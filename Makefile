include .env
export

.PHONY: setup dev dev-frontend dev-pwa dev-pwa-hmr stop build migrate seed lint test clean logs backend-shell db-studio gcloud-auth deploy-setup deploy-secrets-sync deploy-trigger-setup deploy-trigger-list deploy-backend deploy-verify deploy-frontend

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

dev-pwa-hmr:
	@bash scripts/log.sh MAKE "⚡" "Backend (:8000) + Vite (:5173) + HTTPS proxy (:5443) — PWA + HMR"
	@LAN_IP=$$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "<your-mac-ip>"); \
		bash scripts/log.sh MAKE "💻" "Mac:    https://localhost:5443"; \
		bash scripts/log.sh MAKE "📱" "iPhone: https://$$LAN_IP:5443 (same Wi-Fi, root cert trusted)"
	@cd backend && poetry install --quiet 2>/dev/null || true
	cd frontend && VITE_DEV_PWA=true npx concurrently -k -n api,vite,https -c blue,green,magenta \
		"cd ../backend && poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload" \
		"npm run dev -- --host 0.0.0.0 --port 5173" \
		"npx local-ssl-proxy --source 5443 --target 5173 --hostname 0.0.0.0 --cert .certs/dev-cert.pem --key .certs/dev-key.pem"

stop:
	docker-compose down

migrate:
	@bash scripts/log.sh MAKE "🔄" "Running Supabase migrations (pooler URL)"
	@if [ -z "$$SUPABASE_DB_PASSWORD" ]; then echo "ERROR: SUPABASE_DB_PASSWORD not in .env" && exit 1; fi
	@POOLER_URL=$$(cat supabase/.temp/pooler-url 2>/dev/null); \
		if [ -z "$$POOLER_URL" ]; then echo "ERROR: supabase/.temp/pooler-url missing — run 'supabase link' first" && exit 1; fi; \
		ENC_PASS=$$(python3 -c "import urllib.parse,os;print(urllib.parse.quote(os.environ['SUPABASE_DB_PASSWORD'], safe=''))"); \
		DB_URL=$$(echo "$$POOLER_URL" | sed "s|@|:$$ENC_PASS@|"); \
		supabase db push --db-url "$$DB_URL" --yes

seed:
	@bash scripts/log.sh MAKE "📝" "Seeding dev data"
	supabase db reset

lint:
	@bash scripts/log.sh MAKE "🔍" "Running linters"
	cd backend && poetry run ruff check .
	cd frontend && npm run lint

test:
	@bash scripts/log.sh MAKE "🧪" "Running test suites"
	cd backend && poetry run pytest
	cd frontend && npm run test

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
