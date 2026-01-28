.PHONY: install dev lint format typecheck pytest pytest-watch test audit

install:
	pip install -r requirements.txt

dev:
	uvicorn main:app --host 0.0.0.0 --port 8000 --reload

lint:
	ruff check .

format:
	ruff format .

typecheck:
	pyright

pytest:
	python -m pytest

pytest-watch:
	python -m pytest --watch

test: typecheck lint pytest

audit:
	pip-audit
