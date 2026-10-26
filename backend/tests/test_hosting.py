from pathlib import Path
import secrets

import pytest

from app import create_app


def test_vercel_app_initializes_without_writing_to_its_bundle(monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    monkeypatch.setenv('FLASK_ENV', 'development')
    monkeypatch.setenv('SECRET_KEY', secrets.token_hex(32))
    monkeypatch.setenv('DATABASE_URL', 'postgresql+psycopg://test:test@127.0.0.1/test')

    def forbidden_write(*args, **kwargs):
        raise AssertionError('Production attempted to create a local directory')

    with monkeypatch.context() as read_only:
        read_only.setattr(Path, 'mkdir', forbidden_write)
        app = create_app({'TESTING': True})
        assert app.config['SESSION_COOKIE_SECURE'] is True
        # No database connection is needed to initialize the WSGI application.
        response = app.test_client().get('/api/v1/auth/csrf')
        assert response.status_code == 200


def test_vercel_requires_environment_signing_key(monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    monkeypatch.delenv('SECRET_KEY', raising=False)
    with pytest.raises(RuntimeError, match='SECRET_KEY'):
        create_app()
