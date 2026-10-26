r"""Copy every record from the local SQLite database into an empty PostgreSQL database.

Usage (PowerShell, from the project folder):
    .\.venv\Scripts\python.exe scripts\migrate_sqlite_to_postgres.py

The target URL is read from DATABASE_URL in backend/.env.vercel (git-ignored) and is
never printed. The source SQLite file is opened read-only and never modified. The
script refuses to run when the target already contains users, so it cannot overwrite
a database that is in use.
"""
import argparse
import sys
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy import create_engine, func, select, text

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'backend'))


def normalize(url):
    for prefix in ('postgres://', 'postgresql://'):
        if url.startswith(prefix):
            return 'postgresql+psycopg://' + url[len(prefix):]
    return url


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--source', default=str(root / 'backend' / 'instance' / 'workday.db'))
    parser.add_argument('--env-file', default=str(root / 'backend' / '.env.vercel'))
    parser.add_argument('--target', help='Target URL (testing only; prefer --env-file so it is not in shell history)')
    args = parser.parse_args()

    target_url = args.target or dotenv_values(args.env_file).get('DATABASE_URL')
    if not target_url:
        sys.exit(f'DATABASE_URL is missing from {args.env_file}')
    target_url = normalize(target_url.strip())
    source = Path(args.source).resolve()
    if not source.exists():
        sys.exit(f'Source database not found: {source}')

    from flask_migrate import upgrade
    from app import create_app
    from app.extensions import db

    app = create_app({'SQLALCHEMY_DATABASE_URI': target_url})
    with app.app_context():
        target = db.engine
        print('Target:', target.url.render_as_string(hide_password=True).split('@')[-1])
        upgrade(directory=str(root / 'backend' / 'migrations'))
        tables = db.metadata.sorted_tables
        users = next(t for t in tables if t.name == 'users')
        with target.connect() as conn:
            if conn.execute(select(func.count()).select_from(users)).scalar():
                sys.exit('Target already has users - refusing to copy over existing data.')

        src = create_engine(f'sqlite:///file:{source.as_posix()}?mode=ro&uri=true')
        counts = {}
        with src.connect() as read, target.begin() as write:
            for table in tables:
                order = [table.c.id] if 'id' in table.c else []
                rows = [dict(r._mapping) for r in read.execute(select(table).order_by(*order))]
                if rows:
                    write.execute(table.insert(), rows)
                counts[table.name] = len(rows)
            if target.dialect.name == 'postgresql':
                # Rows were inserted with explicit ids; move each id sequence past them.
                for table in tables:
                    if 'id' in table.c and counts[table.name]:
                        write.execute(text(
                            f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), "
                            f"(SELECT MAX(id) FROM {table.name}))"))

        with src.connect() as read, target.connect() as check:
            for table in tables:
                a = read.execute(select(func.count()).select_from(table)).scalar()
                b = check.execute(select(func.count()).select_from(table)).scalar()
                status = 'OK' if a == b else 'MISMATCH'
                print(f'  {table.name:<20} sqlite={a:<5} target={b:<5} {status}')
                if a != b:
                    sys.exit('Copy verification failed.')
        src.dispose()
    print('Done: all records copied and verified.')


if __name__ == '__main__':
    main()
