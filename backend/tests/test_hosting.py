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


def test_production_rejects_sqlite_unless_single_host_opt_in(monkeypatch, tmp_path):
    monkeypatch.setenv('FLASK_ENV', 'production')
    monkeypatch.delenv('VERCEL', raising=False)
    monkeypatch.setenv('SECRET_KEY', secrets.token_hex(32))
    monkeypatch.setenv('DATABASE_URL', 'sqlite:///' + str(tmp_path / 'host.db').replace('\\', '/'))
    monkeypatch.delenv('ALLOW_SQLITE_IN_PRODUCTION', raising=False)
    with pytest.raises(RuntimeError, match='PostgreSQL'):
        create_app()
    monkeypatch.setenv('ALLOW_SQLITE_IN_PRODUCTION', 'true')
    app = create_app()
    assert app.config['SESSION_COOKIE_SECURE'] is True
    monkeypatch.setenv('VERCEL', '1')
    with pytest.raises(RuntimeError, match='PostgreSQL'):
        create_app()


def test_trusted_proxy_hops_use_last_forwarded_client(monkeypatch):
    monkeypatch.setenv('TRUSTED_PROXY_HOPS', '1')
    app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': 'sqlite://', 'SECRET_KEY': 'test-secret-not-for-production'})

    @app.get('/_probe')
    def probe():
        from flask import request
        return {'ip': request.remote_addr, 'secure': request.is_secure}

    # A client-supplied value is ignored; only the hop appended by the proxy counts.
    response = app.test_client().get('/_probe', headers={'X-Forwarded-For': '6.6.6.6, 203.0.113.9', 'X-Forwarded-Proto': 'https'})
    assert response.json == {'ip': '203.0.113.9', 'secure': True}


def test_vercel_requires_environment_signing_key(monkeypatch):
    monkeypatch.setenv('VERCEL', '1')
    monkeypatch.delenv('SECRET_KEY', raising=False)
    with pytest.raises(RuntimeError, match='SECRET_KEY'):
        create_app()
