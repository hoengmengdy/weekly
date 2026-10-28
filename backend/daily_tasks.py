"""Minute worker for daily assignments in Docker or a self-hosted deployment."""
import logging
import time
from app import create_app
from app.extensions import db
from app.recurring import generate_daily_tasks


def main():
    logging.basicConfig(level=logging.INFO)
    app = create_app()
    while True:
        with app.app_context():
            try:
                count = generate_daily_tasks()
                if count:
                    app.logger.info('Created %s daily tasks.', count)
            except Exception:
                db.session.rollback()
                app.logger.exception('Daily task generation failed; retrying in one minute.')
            finally:
                db.session.remove()
        time.sleep(60)


if __name__ == '__main__':
    main()
