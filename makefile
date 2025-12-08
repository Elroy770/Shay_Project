# ==========================================
# Variables
# ==========================================
PROJECT_ID=shay-project-477811
REGION=us-central1
REGISTRY=us-central1-docker.pkg.dev/$(PROJECT_ID)/shay-registry

# קביעת גרסה אחידה לריצה זו (יום.חודש.שנה.שעה.דקה)
DATE := $(shell date +"%d.%m.%Y.%H.%M")

FE_IMAGE=$(REGISTRY)/shay-frontend:$(DATE)
BE_IMAGE=$(REGISTRY)/shay-backend:$(DATE)

.PHONY: glogin gc-create-sql \
        release-frontend release-backend release-all \
        local-up local-down local-rebuild

# ==========================================
# Cloud Operations (Using Cloud Build YAMLs)
# ==========================================

glogin:
	gcloud auth login
	gcloud config set project $(PROJECT_ID)

# ==========================================
# Cloud Operations (Updated Paths)
# ==========================================

# בנייה ופריסה של Frontend בלבד
release-frontend:
	@echo "🚀 מפעיל Pipeline ל-Frontend (גרסה: $(DATE))..."
	gcloud builds submit . \
		--config cloudbuild/frontend.yaml \
		--substitutions=_IMAGE_NAME=$(FE_IMAGE)

# בנייה ופריסה של Backend בלבד
release-backend:
	@echo "🚀 מפעיל Pipeline ל-Backend (גרסה: $(DATE))..."
	gcloud builds submit . \
		--config cloudbuild/backend.yaml \
		--substitutions=_IMAGE_NAME=$(BE_IMAGE)

# בנייה ופריסה של הכל ביחד
release-all:
	@echo "🚀🚀 מפעיל Pipeline משולב (גרסה: $(DATE))..."
	gcloud builds submit . \
		--config cloudbuild/all.yaml \
		--substitutions=_FE_IMAGE=$(FE_IMAGE),_BE_IMAGE=$(BE_IMAGE)
# ==========================================
# Local Development
# ==========================================

local-up:
	@echo "🏠 מעלה סביבה מקומית..."
	docker-compose up -d

local-down:
	@echo "🔌 מכבה סביבה מקומית..."
	docker-compose down

local-rebuild:
	@echo "🔨 בונה מחדש ומריץ מקומית..."
	docker-compose up -d --build

# ==========================================
# Legacy / Setup Utilities
# ==========================================
gc-create-sql:
	gcloud sql instances create mysql-1 \
		--database-version=MYSQL_8_0 \
		--tier=db-f1-micro \
		--region=$(REGION) \
		--root-password=12345 \
		--no-backup
	gcloud sql users set-password root \
		--host=% \
		--instance=mysql-1 \
		--password=12345