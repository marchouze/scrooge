# Makefile — bank prototype
#
# One-command bring-up for the local environment. Per the local-base-
# infrastructure spec (Owner Inbox/2026-05-06_local-base-infrastructure-spec.md).

SHELL := /bin/bash
BUN   := $(HOME)/.bun/bin/bun

.PHONY: help install up down reset seed test typecheck lint format ci scenario citation-gate recon dashboard

help:
	@echo "make install        Install dependencies"
	@echo "make up             Run the hello-bank scenario (default scenario)"
	@echo "make down           Graceful stop (no daemons in M1)"
	@echo "make reset          Wipe local state; clean slate"
	@echo "make seed           Apply seed scenario(s)"
	@echo "make test           Run unit & integration tests"
	@echo "make typecheck      TypeScript --noEmit"
	@echo "make lint           Biome lint"
	@echo "make format         Biome format --write"
	@echo "make citation-gate  P2 gate over the local event store"
	@echo "make recon          Reconciliation harness (P1)"
	@echo "make dashboard      Live bank operations dashboard on http://localhost:3010"
	@echo "make ci             Full local CI loop"

install:
	@$(BUN) install

up: reset seed
	@true

down:
	@true

reset:
	@rm -rf .local
	@mkdir -p .local

seed:
	@$(BUN) run scenario:hello

test:
	@$(BUN) test

typecheck:
	@$(BUN) run typecheck

lint:
	@$(BUN) run lint

format:
	@$(BUN) run format

citation-gate:
	@$(BUN) run citation-gate

recon:
	@$(BUN) run recon

dashboard:
	@$(BUN) run dashboard

ci: typecheck lint test
	@$(MAKE) reset
	@$(MAKE) seed
	@$(MAKE) citation-gate
	@$(MAKE) recon
	@echo "CI loop complete"
