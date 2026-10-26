"""Standard WSGI entrypoint detected by Vercel with Root Directory=backend."""

if __package__:
    from .app import create_app
else:
    from app import create_app

app = create_app()
