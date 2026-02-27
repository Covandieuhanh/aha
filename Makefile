.PHONY: up down restart logs health backup

up:
	docker compose up -d --build

down:
	docker compose down

restart: down up

logs:
	docker compose logs -f

health:
	curl -fsS http://127.0.0.1:8080/health

backup:
	mkdir -p backups && cp data/store.json backups/store-$$(date +%Y%m%d-%H%M%S).json
