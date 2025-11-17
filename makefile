glogin:
	gcloud auth login
	gcloud config set project my-docker-project-12345

create-sql:
	gcloud sql instances create mysql-1 \
		--database-version=MYSQL_8_0 \
		--tier=db-f1-micro \
		--region=us-central1 \
		--root-password=150721 \
		--no-backup

	gcloud sql users set-password root \
		--host=% \
		--instance=mysql-1 \
		--password=150721

# Global variables
DATE=$(shell date +"%m.%d")
USER=$(shell whoami)

# Backend variables
BACKEND_IMAGE=us-central1-docker.pkg.dev/my-docker-project-12345/my-repo/sp_backend
BACKEND_LAST=$(shell docker images --format "{{.Tag}}" $(BACKEND_IMAGE) | grep "^$(DATE)" | awk -F. '{print $$3}' | sort -n | tail -1)
BACKEND_NEXT=$(shell if [ -z "$(BACKEND_LAST)" ]; then echo 1; else expr $(BACKEND_LAST) + 1; fi)
BACKEND_TAG=$(DATE).$(BACKEND_NEXT).$(USER)

# Frontend variables
FRONTEND_IMAGE=us-central1-docker.pkg.dev/my-docker-project-12345/my-repo/sp_frontend
FRONTEND_LAST=$(shell docker images --format "{{.Tag}}" $(FRONTEND_IMAGE) | grep "^$(DATE)" | awk -F. '{print $$3}' | sort -n | tail -1)
FRONTEND_NEXT=$(shell if [ -z "$(FRONTEND_LAST)" ]; then echo 1; else expr $(FRONTEND_LAST) + 1; fi)
FRONTEND_TAG=$(DATE).$(FRONTEND_NEXT).$(USER)

# Fetch backend Cloud Run URL dynamically
BACKEND_URL=$(shell gcloud run services describe sp-backend --region us-central1 --format='value(status.url)' 2>/dev/null || echo "https://sp-backend-657270916429.us-central1.run.app")

build-backend:
	docker buildx build \
		--platform linux/amd64,linux/arm64 \
		-t $(BACKEND_IMAGE):$(BACKEND_TAG) \
		--push \
		~/Desktop/Shay_Project/backend/
	@echo "✅ Backend built and pushed: $(BACKEND_IMAGE):$(BACKEND_TAG)"

deploy-backend:
	gcloud run deploy sp-backend \
	--image $(BACKEND_IMAGE):$(DATE).$(BACKEND_LAST).$(USER) \
	--platform managed \
	--add-cloudsql-instances my-docker-project-12345:us-central1:mysql-1 \
	--region us-central1 \
	--allow-unauthenticated \
	--set-env-vars DB_SOCKET_PATH=/cloudsql/my-docker-project-12345:us-central1:mysql-1,DB_HOST=/cloudsql/my-docker-project-12345:us-central1:mysql-1,DB_USER=root,DB_PASSWORD=150721,DB_NAME=Shay_Project,DB_PORT=3306 \
	--port=3000 \
	--set-secrets=OPENAI_API_KEY=OPENAI_API_KEY:latest
	@echo "🚀 Backend deployed: $(DATE).$(BACKEND_LAST).$(USER)"

build-frontend:
	docker buildx build \
		--platform linux/amd64,linux/arm64 \
		-t $(FRONTEND_IMAGE):$(FRONTEND_TAG) \
		--push \
		~/Desktop/Shay_Project/frontend/
	@echo "✅ Frontend built and pushed: $(FRONTEND_IMAGE):$(FRONTEND_TAG)"

deploy-frontend:
	gcloud run deploy sp-frontend \
	--image $(FRONTEND_IMAGE):$(DATE).$(FRONTEND_LAST).$(USER) \
	--platform managed \
	--region us-central1 \
	--allow-unauthenticated \
	--port=80 \
	--set-env-vars API_URL=$(BACKEND_URL)
	@echo "🚀 Frontend deployed: $(DATE).$(FRONTEND_LAST).$(USER)"
	@echo "   Backend URL: $(BACKEND_URL)"

build: build-backend build-frontend
	@echo "✅ All images built and pushed"

deploy: deploy-backend deploy-frontend
	@echo "🚀 All services deployed"