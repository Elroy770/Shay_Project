glogin:
	gcloud auth login
	gcloud config set project my-docker-project-12345

gc create-sql:
	gcloud sql instances create mysql-1 \
	--database-version=MYSQL_8_0 \
	--tier=db-f1-micro \
	--region=us-central1 \ 
	--root-password=150721 \
	--no-backup \
	gcloud sql users set-password root \                                   ─╯
    --host=% \
    --instance=mysql-1 \
    --password=150721


IMAGE=us-central1-docker.pkg.dev/my-docker-project-12345/my-repo/sp_backend
DATE=$(shell date +"%m.%d")
LAST=$(shell docker images --format "{{.Tag}}" $(IMAGE) | grep "^$(DATE)" | awk -F. '{print $$3}' | sort -n | tail -1)
NEXT=$(shell if [ -z "$(LAST)" ]; then echo 1; else expr $(LAST) + 1; fi)
TAG=$(DATE).$(NEXT)

build:
	# בונה מולטי-פלטפורם ומשתמש ב-buildx
	docker buildx build \
		--platform linux/amd64,linux/arm64 \
		-t $(IMAGE):$(TAG) \
		--push \
		~/Desktop/Shay_Project/backend/
	@echo "✅ Built and pushed multi-platform image: $(IMAGE):$(TAG)"


deploy:
	gcloud run deploy sp-backend \
	--image $(IMAGE):$(DATE).$(LAST) \
	--platform managed \
	--add-cloudsql-instances my-docker-project-12345:us-central1:mysql-1 \
	--region us-central1 \
	--allow-unauthenticated \
	--set-env-vars DB_SOCKET_PATH=/cloudsql/my-docker-project-12345:us-central1:mysql-1,DB_HOST=/cloudsql/my-docker-project-12345:us-central1:mysql-1,DB_USER=root,DB_PASSWORD=150721,DB_NAME=Shay_Project,DB_PORT=3306 \
	--port=3000 \
	--set-secrets=OPENAI_API_KEY=OPENAI_API_KEY:latest
	@echo "🚀 Deployed version: $(DATE).$(LAST)"