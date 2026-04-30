include .env
export

.PHONY: setup dev dev-frontend dev-pwa dev-pwa-hmr stop build migrate seed lint test clean logs backend-shell db-studio gcloud-auth deploy-backend-setup deploy-backend deploy-backend-verify deploy-frontend

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
	@bash scripts/log.sh MAKE "🔄" "Running Supabase migrations"
	supabase db push

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

gcloud-auth:
	@ACTIVE=$$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null); \
	if [ -z "$$ACTIVE" ]; then \
		bash scripts/log.sh DEPLOY "🔑" "Authenticating with Google Cloud"; \
		gcloud auth login; \
	fi
	@gcloud config set project $(GCP_PROJECT_ID) 2>/dev/null

deploy-backend-setup: gcloud-auth
	@bash scripts/log.sh DEPLOY "🔧" "Enabling GCP APIs and creating Artifact Registry repo"
	gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
	gcloud artifacts repositories create propos \
		--repository-format=docker \
		--location=$(GCP_REGION) || true

deploy-backend: gcloud-auth
	@bash scripts/log.sh DEPLOY "🚀" "Building and deploying backend to Cloud Run"
	gcloud builds submit \
		--config config/docker/cloudbuild.yaml \
		--substitutions _IMAGE=$(GCP_REGION)-docker.pkg.dev/$(GCP_PROJECT_ID)/propos/api:latest .
	gcloud run deploy propos-api \
		--image $(GCP_REGION)-docker.pkg.dev/$(GCP_PROJECT_ID)/propos/api:latest \
		--region $(GCP_REGION) --platform managed \
		--allow-unauthenticated --port 8000 \
		--min-instances 0 --max-instances 1 \
		--memory 512Mi --cpu 1 \
		--env-vars-file config/docker/cloudrun-env.yaml
	@bash scripts/log.sh DEPLOY "✅" "Backend deployed. URL:"
	@gcloud run services describe propos-api --region $(GCP_REGION) --format='value(status.url)'

deploy-backend-verify:
	@bash scripts/log.sh DEPLOY "🔍" "Verifying backend health"
	@curl -sf $$(gcloud run services describe propos-api --region $(GCP_REGION) --format='value(status.url)')/health && echo "" || echo "Health check failed"

deploy-frontend:
	@bash scripts/log.sh DEPLOY "🚀" "Deploying frontend to Vercel"
	cd frontend && npx vercel --prod
