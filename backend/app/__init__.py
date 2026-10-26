import os
import secrets
from datetime import date, timedelta
from pathlib import Path
import click
from dotenv import load_dotenv
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException
from werkzeug.security import generate_password_hash
from .extensions import db, migrate, csrf, limiter


@event.listens_for(Engine, 'connect')
def sqlite_foreign_keys(connection, record):
    if connection.__class__.__module__.startswith('sqlite3'):
        connection.execute('PRAGMA foreign_keys=ON')


def create_app(test_config=None):
    root = Path(__file__).resolve().parents[1]
    load_dotenv(root / '.env')
    production = os.getenv('FLASK_ENV') == 'production' or os.getenv('VERCEL') == '1'
    app = Flask(__name__, instance_path=str(root / 'instance'), static_folder=None)
    # Hosted production uses an external database and environment signing key.
    # Its application bundle may be read-only; only local development needs it.
    if not production:
        Path(app.instance_path).mkdir(exist_ok=True)
    secret = os.getenv('SECRET_KEY')
    if production and (not secret or len(secret) < 32):
        raise RuntimeError('Production SECRET_KEY must have at least 32 characters')
    if not secret:
        key_file = Path(app.instance_path) / 'development.key'
        if not key_file.exists():
            key_file.write_text(secrets.token_hex(32), encoding='utf-8')
        secret = key_file.read_text(encoding='utf-8')
    database_url = os.getenv('DATABASE_URL') or 'sqlite:///' + str(root / 'instance' / 'workday.db').replace('\\', '/')
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql+psycopg://', 1)
    elif database_url.startswith('postgresql://'):
        database_url = database_url.replace('postgresql://', 'postgresql+psycopg://', 1)
    app.config.update(
        SECRET_KEY=secret, SQLALCHEMY_DATABASE_URI=database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SECURE=production,
        SESSION_COOKIE_SAMESITE='Lax', PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
        MAX_CONTENT_LENGTH=int(os.getenv('MAX_CONTENT_LENGTH', 10 * 1024 * 1024)),
        UPLOAD_FOLDER=os.getenv('UPLOAD_FOLDER') or str(root / 'uploads'),
        FRONTEND_URL=os.getenv('FRONTEND_URL', 'http://127.0.0.1:5173').rstrip('/'),
        RATELIMIT_STORAGE_URI=os.getenv('RATELIMIT_STORAGE_URI', 'memory://'),
        ALLOW_OVERNIGHT=os.getenv('ALLOW_OVERNIGHT', 'false').lower() == 'true',
        COMPANY_NAME=os.getenv('COMPANY_NAME', 'Workday'),
        PDF_FONT_PATH=os.getenv('PDF_FONT_PATH') or str(root / 'assets' / 'NotoSansKhmer-Regular.ttf'),
        MAIL_SERVER=os.getenv('MAIL_SERVER'), MAIL_PORT=int(os.getenv('MAIL_PORT', '587')),
        MAIL_USERNAME=os.getenv('MAIL_USERNAME'), MAIL_PASSWORD=os.getenv('MAIL_PASSWORD'),
        MAIL_FROM=os.getenv('MAIL_FROM', ''), MAIL_USE_TLS=os.getenv('MAIL_USE_TLS', 'true') == 'true',
    )
    if test_config:
        app.config.update(test_config)
    if production and database_url.startswith('sqlite:') and not test_config:
        raise RuntimeError('Production requires PostgreSQL DATABASE_URL')
    db.init_app(app)
    from . import models
    migrate.init_app(app, db, render_as_batch=database_url.startswith('sqlite:'))
    csrf.init_app(app)
    limiter.init_app(app)
    CORS(app, resources={r'/api/*': {'origins': [app.config['FRONTEND_URL']]}}, supports_credentials=True)
    from .routes import api
    app.register_blueprint(api, url_prefix='/api/v1')

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(error={'code': error.code, 'message': error.description}), error.code

    @app.errorhandler(IntegrityError)
    def constraint_error(error):
        db.session.rollback()
        return jsonify(error={'code': 409, 'message': 'A unique value already exists or a database constraint failed.'}), 409

    @app.errorhandler(Exception)
    def server_error(error):
        db.session.rollback()
        app.logger.exception('Unhandled request error')
        return jsonify(error={'code': 500, 'message': 'An unexpected error occurred.'}), 500

    @app.after_request
    def headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'"
        if production:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        if response.content_type and ('json' in response.content_type or '/exports/' in __import__('flask').request.path):
            response.headers['Cache-Control'] = 'no-store'
        return response

    @app.get('/health')
    def health():
        db.session.execute(db.text('SELECT 1'))
        return {'status': 'ok'}

    @app.get('/')
    @app.get('/<path:path>')
    def frontend(path=''):
        if path.startswith('api/'):
            from flask import abort
            abort(404)
        dist = root.parent / 'frontend' / 'dist'
        if not (dist / 'index.html').exists():
            return {'message': 'API is running. Start frontend with npm run dev, or npm run build.'}
        if path and (dist / path).is_file() and (dist / path).resolve().is_relative_to(dist.resolve()):
            return send_from_directory(dist, path)
        return send_from_directory(dist, 'index.html')

    @app.cli.command('create-admin')
    @click.option('--username', prompt=True)
    @click.option('--email', prompt=True)
    @click.option('--name', prompt=True)
    @click.password_option()
    def create_admin(username, email, name, password):
        from .schemas import EmployeeInput
        data = EmployeeInput(employee_id='ADMIN-' + secrets.token_hex(3), full_name=name,
                             username=username, email=email, password=password, role='super_admin')
        values = data.model_dump(exclude={'password'})
        db.session.add(models.User(**values, password_hash=generate_password_hash(password)))
        db.session.commit()
        click.echo('Super admin created. No sample records were added.')

    @app.cli.command('notify-deadlines')
    def notify_deadlines():
        from .services import generate_deadline_notifications
        click.echo(f'{generate_deadline_notifications()} notifications created.')

    return app
