from datetime import date, timedelta
import pytest
from app import telegram
from app.extensions import db
from app.models import User

BASE='/api/v1'


@pytest.fixture
def bot(app,monkeypatch):
    app.config['TELEGRAM_BOT_TOKEN']='123:test-token'
    calls=[]
    def call(method,**params):
        calls.append((method,params))
        return {'ok':True,'result':{'username':'workday_test_bot'}}
    monkeypatch.setattr(telegram,'call',call)
    return calls


def task(**values):
    return {'title':'Design launch poster','start_date':date.today().isoformat(),'deadline':(date.today()+timedelta(days=3)).isoformat(),
            'priority':'High','assigned_employee_ids':[3]}|values


def webhook(client,app,text,chat=555,secret=None):
    with app.app_context():
        secret=secret or telegram.webhook_secret()
    return client.post(BASE+'/telegram/webhook',json={'message':{'text':text,'chat':{'id':chat}}},headers={'X-Telegram-Bot-Api-Secret-Token':secret})


def link_code(app,user_id):
    with app.test_request_context():
        return telegram.link_code(user_id)


def test_link_needs_bot_token(client,sign_in):
    sign_in(3)
    assert client.post(BASE+'/auth/telegram/link').status_code==503


def test_link_registers_webhook_and_returns_bot_url(client,sign_in,bot):
    sign_in(3)
    response=client.post(BASE+'/auth/telegram/link')
    assert response.status_code==200
    assert response.json['url'].startswith('https://t.me/workday_test_bot?start=3_')
    method,params=bot[0]
    assert method=='setWebhook' and params['url'].endswith('/api/v1/telegram/webhook')


def test_webhook_links_chat_and_rejects_bad_codes(client,app,sign_in,bot):
    assert webhook(client,app,'/start '+link_code(app,3),secret='wrong').status_code==403
    assert webhook(client,app,'/start 3_1_forged').status_code==200
    with app.app_context():
        assert db.session.get(User,3).telegram_chat_id is None
    assert webhook(client,app,'/start '+link_code(app,3)).status_code==200
    with app.app_context():
        assert db.session.get(User,3).telegram_chat_id=='555'
    assert bot[-1][0]=='sendMessage' and 'Person 3' in bot[-1][1]['text']
    sign_in(3)
    assert client.get(BASE+'/auth/me').json['telegram_connected'] is True
    assert client.delete(BASE+'/auth/telegram').json['telegram_connected'] is False


def test_new_assignment_is_sent_to_linked_users_only_after_saving(client,app,sign_in,bot):
    with app.app_context():
        db.session.get(User,3).telegram_chat_id='555'
        db.session.commit()
    sign_in(2)
    assert client.post(BASE+'/tasks',json=task()).status_code==201
    sent=[params for method,params in bot if method=='sendMessage']
    assert len(sent)==1 and sent[0]['chat_id']=='555'
    assert 'Design launch poster' in sent[0]['text'] and 'ខ្ពស់' in sent[0]['text'] and 'Person 2' in sent[0]['text']
    bot.clear()
    assert client.post(BASE+'/tasks',json=task(deadline='2000-01-01')).status_code==422
    assert client.patch(BASE+'/tasks/1',json={'title':'Renamed'}).status_code==200
    assert not [m for m,_ in bot if m=='sendMessage']


def test_assigning_yourself_also_sends(client,app,sign_in,bot):
    with app.app_context():
        db.session.get(User,2).telegram_chat_id='222'
        db.session.commit()
    sign_in(2)
    assert client.post(BASE+'/tasks',json=task(assigned_employee_ids=[2])).status_code==201
    sent=[params for method,params in bot if method=='sendMessage']
    assert len(sent)==1 and sent[0]['chat_id']=='222'


def test_daily_copies_are_sent_once(client,app,sign_in,bot,monkeypatch):
    from app import recurring
    day=[date.today()]
    monkeypatch.setattr(recurring,'today',lambda: day[0])
    with app.app_context():
        db.session.get(User,3).telegram_chat_id='555'
        db.session.commit()
    sign_in(2)
    assert client.post(BASE+'/tasks',json=task(deadline=date.today().isoformat(),repeat_daily=True)).status_code==201
    bot.clear()
    day[0]+=timedelta(days=1)
    sign_in(3)
    assert client.get(BASE+'/tasks').status_code==200
    assert client.get(BASE+'/tasks').status_code==200
    sent=[params for method,params in bot if method=='sendMessage']
    assert len(sent)==1 and sent[0]['chat_id']=='555'
    assert 'Design launch poster' in sent[0]['text'] and 'Person 2' in sent[0]['text']
    bot.clear()
    day[0]+=timedelta(days=1)
    with app.app_context():
        assert recurring.generate_daily_tasks()==1
    assert [p['chat_id'] for m,p in bot if m=='sendMessage']==['555']
