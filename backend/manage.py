if __package__:
    from .app import create_app
else:
    from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000)
