import os
import sys
from pathlib import Path
from datetime import date, timedelta
import pytest
from werkzeug.security import generate_password_hash

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app import create_app
from app.extensions import db
from app.models import User, Department, Task, TaskAssignment


@pytest.fixture(autouse=True)
def ignore_host_dotenv(monkeypatch):
    # A hosting machine's backend/.env (production mode, real secret) must not leak into tests.
    import importlib
    monkeypatch.setattr(importlib.import_module('app'), 'load_dotenv', lambda *args, **kwargs: None)


@pytest.fixture
def app(tmp_path):
    # TEST_DATABASE_URL runs the suite against a disposable PostgreSQL database (tables are dropped).
    app = create_app({'TESTING':True,'SQLALCHEMY_DATABASE_URI':os.getenv('TEST_DATABASE_URL','sqlite://'),
                      'SECRET_KEY':'test-secret-not-for-production','WTF_CSRF_ENABLED':False,
                      'RATELIMIT_ENABLED':False,'UPLOAD_FOLDER':str(tmp_path/'uploads')})
    with app.app_context():
        db.drop_all()
        db.create_all()
        dept = Department(name='Operations')
        db.session.add(dept)
        db.session.flush()
        password_hash = generate_password_hash('Test-password-123')
        for id,role,manager in [(1,'super_admin',None),(2,'manager',None),(5,'manager',None),(3,'employee',2),(4,'employee',5),(6,'admin',None)]:
            db.session.add(User(id=id,employee_id=f'EMP-{id}',full_name=f'Person {id}',username=f'user{id}',email=f'u{id}@example.com',password_hash=password_hash,role=role,manager_id=manager,department_id=dept.id,date_joined=date(2026,1,1)))
        db.session.flush()
        for id,creator,assignee in [(1,2,3),(2,5,4)]:
            task = Task(id=id,title=f'Task {id}',creator_id=creator,department_id=dept.id,start_date=date.today()-timedelta(days=2),deadline=date.today()+timedelta(days=2),internal_notes='Private manager note')
            db.session.add(task)
            db.session.flush()
            db.session.add(TaskAssignment(task_id=id,user_id=assignee))
        db.session.commit()
        if db.engine.dialect.name == 'postgresql':
            # Seed rows use explicit ids; move sequences past them as a real database would.
            for table in db.metadata.sorted_tables:
                if 'id' in table.c:
                    db.session.execute(db.text(f"SELECT setval(pg_get_serial_sequence('{table.name}','id'), COALESCE((SELECT MAX(id) FROM {table.name}), 0) + 1, false)"))
            db.session.commit()
    yield app
    with app.app_context():
        db.session.remove()
        db.drop_all()
        db.engine.dispose()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def sign_in(client):
    def login(id):
        response = client.post('/api/v1/auth/login',json={'username':f'user{id}','password':'Test-password-123'})
        assert response.status_code == 200,response.json
        return response
    return login


@pytest.fixture
def report_data():
    return {'task_id':1,'report_date':date.today().isoformat(),'work_description':'Processed documents',
            'expected_output':'Ten checked files','actual_output':'Eight checked files',
            'quantity_target':10,'quantity_completed':8,'start_time':'09:00','end_time':'11:30'}
