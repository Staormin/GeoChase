.PHONY: help dev dev-detach prod prod-detach build build-dev build-prod \
       down restart clean logs logs-dev logs-prod ps \
       shell lint format format-check type-check \
       test test-unit-watch test-unit-coverage \
       install ci \
       pkg-add pkg-remove pkg-update pkg-outdated audit audit-fix \
       test-e2e

.DEFAULT_GOAL := help

# Variables
COMPOSE = docker compose
DEV     = dev
RUN     = $(COMPOSE) run --rm $(DEV)

# ──────────────────────────────────────────────
# Help
# ──────────────────────────────────────────────

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ──────────────────────────────────────────────
# Build
# ──────────────────────────────────────────────

build: ## Build all Docker images
	$(COMPOSE) build $(DEV)

# ──────────────────────────────────────────────
# Lifecycle
# ──────────────────────────────────────────────

up: ## Start development server with hot reload
	$(COMPOSE) up $(DEV) --build -d

down: ## Stop all services
	$(COMPOSE) down

restart: ## Restart all running services
	$(COMPOSE) restart

clean: ## Stop and remove containers, volumes, and images
	$(COMPOSE) down -v --rmi local

# ──────────────────────────────────────────────
# Logs & Status
# ──────────────────────────────────────────────

logs: ## View logs from all services
	$(COMPOSE) logs -f

ps: ## Show running containers
	$(COMPOSE) ps

# ──────────────────────────────────────────────
# Shell
# ──────────────────────────────────────────────

shell: ## Open a shell in the dev container
	$(RUN) sh

# ──────────────────────────────────────────────
# Code Quality
# ──────────────────────────────────────────────

lint: ## Run ESLint with auto-fix
	$(RUN) npm run lint

format: ## Run Prettier formatting
	$(RUN) npm run format

format-check: ## Check formatting without changes
	$(RUN) npm run format:check

type-check: ## Run TypeScript type checking
	$(RUN) npm run type-check

# ──────────────────────────────────────────────
# Testing
# ──────────────────────────────────────────────

test: ## Run unit tests
	$(RUN) npm run test:unit:run

test-unit-watch: ## Run unit tests in watch mode
	$(RUN) npm run test:unit

test-unit-coverage: ## Run unit tests with coverage report
	$(RUN) npm run test:unit:coverage

test-e2e: ## Run e2e tests (usage: make test-e2e [FILE=path/to/spec])
	$(COMPOSE) run --rm e2e npx playwright test $(FILE)

# ──────────────────────────────────────────────
# Dependencies
# ──────────────────────────────────────────────

install: ## Rebuild dev container (installs fresh dependencies)
	$(COMPOSE) build --no-cache $(DEV)

# ──────────────────────────────────────────────
# CI
# ──────────────────────────────────────────────

ci: ## Run full CI pipeline (type-check, lint, format, unit tests)
	$(RUN) sh -c "npm run ci"

# ──────────────────────────────────────────────
# Packages management
# ──────────────────────────────────────────────

pkg-add: ## Add a package (usage: make pkg-add PKG=package-name)
	$(RUN) npm install $(PKG)

pkg-remove: ## Remove a package (usage: make pkg-remove PKG=package-name)
	$(RUN) npm uninstall $(PKG)

pkg-update: ## Update all packages
	$(RUN) npm update --save

pkg-outdated: ## Check for outdated packages
	$(RUN) npm outdated

audit: ## Audit production dependencies for vulnerabilities
	$(RUN) npm audit --omit=dev

audit-fix: ## Fix audit alerts (production only)
	$(RUN) npm audit fix --omit=dev
