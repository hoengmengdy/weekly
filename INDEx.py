"""Run the Flask API and, after npm run build, the React application."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / 'backend'))
from app import create_app

app = create_app()

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=False)
