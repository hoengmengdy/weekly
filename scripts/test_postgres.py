r"""Run the backend test suite against a disposable PostgreSQL database.

Usage (PowerShell, from the project folder):
    .\.venv\Scripts\python.exe scripts\test_postgres.py [extra pytest args]

Reads DATABASE_URL_UNPOOLED (or DATABASE_URL) from .env.local, switches to a separate
database named workday_test on the same server, creates it if needed, and runs pytest
with TEST_DATABASE_URL. The tests drop and recreate every table in workday_test, so the
script refuses to run when the database name is not exactly workday_test.
"""
import os
import subprocess
import sys
import uuid
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

root = Path(__file__).resolve().parents[1]
TEST_DB = 'workday_test'

values = dotenv_values(root / '.env.local')
url = values.get('DATABASE_URL_UNPOOLED') or values.get('DATABASE_URL')
if not url:
    sys.exit('DATABASE_URL is missing from .env.local (run: vercel env pull)')
base = make_url(url).set(drivername='postgresql+psycopg')
test_url = base.set(database=TEST_DB)
if test_url.database != TEST_DB or base.database == TEST_DB:
    sys.exit('Refusing to run: the test database must be separate from the application database.')

admin = create_engine(base, isolation_level='AUTOCOMMIT')
with admin.connect() as conn:
    if not conn.execute(text('SELECT 1 FROM pg_database WHERE datname = :n'), {'n': TEST_DB}).scalar():
        conn.execute(text(f'CREATE DATABASE {TEST_DB}'))
        print(f'Created database {TEST_DB}')
admin.dispose()

print(f'Running tests against {test_url.host}/{TEST_DB}')
env = dict(os.environ, TEST_DATABASE_URL=test_url.render_as_string(hide_password=False))
basetemp = root / '.qa' / ('pytest-pg-' + uuid.uuid4().hex)
sys.exit(subprocess.call([sys.executable, '-m', 'pytest', 'backend/tests', '-q', '-p', 'no:cacheprovider',
                          f'--basetemp={basetemp}', *sys.argv[1:]], cwd=root, env=env))
