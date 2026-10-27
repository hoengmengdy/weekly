"""Telegram task alerts. A user links their chat once (Settings -> Connect Telegram),
then new task assignments are pushed to it by the bot."""
import hashlib
import hmac
import json
import time
import urllib.request
from flask import current_app, g, request

LINK_MAX_AGE = 3600


def configured():
    return bool(current_app.config.get('TELEGRAM_BOT_TOKEN'))


def call(method, **params):
    url = f"https://api.telegram.org/bot{current_app.config['TELEGRAM_BOT_TOKEN']}/{method}"
    req = urllib.request.Request(url, data=json.dumps(params).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=5) as response:
        return json.load(response)


def _sign(text):
    return hmac.new(current_app.config['SECRET_KEY'].encode(), text.encode(), hashlib.sha256).hexdigest()


def webhook_secret():
    # Derived from SECRET_KEY so no extra setting is needed; Telegram echoes it in a header.
    return _sign('telegram-webhook')[:32]


def link_code(user_id):
    # Telegram /start parameters allow only [A-Za-z0-9_-] and 64 characters.
    stamp = int(time.time())
    return f'{user_id}_{stamp}_{_sign(f"telegram-link:{user_id}:{stamp}")[:24]}'


def read_link_code(code):
    try:
        user_id, stamp, signature = code.split('_')
        user_id, stamp = int(user_id), int(stamp)
    except ValueError:
        return None
    valid = hmac.compare_digest(signature, _sign(f'telegram-link:{user_id}:{stamp}')[:24])
    return user_id if valid and 0 <= time.time() - stamp <= LINK_MAX_AGE else None


def public_url(path):
    base = request.host_url.rstrip('/')
    # Serverless hosts terminate TLS before the app; Telegram only accepts https.
    if not request.host.startswith(('localhost', '127.')):
        base = base.replace('http://', 'https://', 1)
    return base + path


def queue(user, text):
    if user.telegram_chat_id and configured():
        g.telegram_outbox = getattr(g, 'telegram_outbox', []) + [(user.telegram_chat_id, text)]


def flush(response):
    """after_request: send queued messages only when the request succeeded (its data is committed)."""
    outbox = g.pop('telegram_outbox', [])
    if response.status_code < 400:
        for chat_id, text in outbox:
            try:
                call('sendMessage', chat_id=chat_id, text=text, disable_web_page_preview=True)
            except Exception:
                current_app.logger.warning('Telegram message could not be sent', exc_info=True)
    return response
