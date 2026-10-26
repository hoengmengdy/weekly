"""Real HTTP integration check with disposable records and random credentials.

Does not control a browser or write to the application's default database.
"""
import sys
import json
import secrets
import threading
import tempfile
import urllib.request
import urllib.error
import http.cookiejar
from pathlib import Path
from datetime import date, timedelta
from werkzeug.serving import make_server
from werkzeug.security import generate_password_hash

root = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root / 'backend'))
from app import create_app
from app.extensions import db
from app.models import User, Department


def main():
    (root/'.qa').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='http-smoke-',dir=root/'.qa') as temporary:
        password = secrets.token_urlsafe(24)
        app = create_app({'TESTING':True,'SECRET_KEY':secrets.token_hex(32),'SQLALCHEMY_DATABASE_URI':'sqlite:///'+str(Path(temporary)/'test.db').replace('\\','/'),
                          'UPLOAD_FOLDER':str(Path(temporary)/'uploads'),'RATELIMIT_ENABLED':False,
                          # Plain-HTTP harness: a production backend/.env would otherwise mark cookies Secure.
                          'SESSION_COOKIE_SECURE':False})
        with app.app_context():
            db.create_all()
            dept = Department(name='QA Operations')
            db.session.add(dept)
            db.session.flush()
            for id,role,manager in [(1,'super_admin',None),(2,'manager',None),(3,'employee',2)]:
                db.session.add(User(id=id,employee_id=f'QA-{id}',username=f'qa{id}',full_name=f'QA Person {id}',email=f'qa{id}@example.com',password_hash=generate_password_hash(password),role=role,manager_id=manager,department_id=dept.id,date_joined=date.today()))
            db.session.commit()
        server = make_server('127.0.0.1',0,app,threaded=True)
        port = server.server_port
        worker = threading.Thread(target=server.serve_forever,daemon=True)
        worker.start()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        base=f'http://127.0.0.1:{port}'
        csrf=''

        def call(path,method='GET',data=None):
            nonlocal csrf
            headers={}
            if data is not None:
                headers['Content-Type']='application/json'
            if method!='GET':
                headers['X-CSRFToken']=csrf
            request = urllib.request.Request(base+path,method=method,headers=headers,data=json.dumps(data).encode() if data is not None else None)
            try:
                with opener.open(request,timeout=10) as response:
                    raw=response.read()
                    return json.loads(raw) if 'application/json' in response.headers.get('Content-Type','') else raw
            except urllib.error.HTTPError as error:
                raise AssertionError(f'{method} {path} returned {error.code}: {error.read().decode()}') from error

        def login(id):
            nonlocal csrf
            csrf=call('/api/v1/auth/csrf')['csrf_token']
            csrf=call('/api/v1/auth/login','POST',{'username':f'qa{id}','password':password})['csrf_token']

        try:
            assert call('/health')['status']=='ok'
            assert b'<div id="root">' in call('/')
            login(2)
            task=call('/api/v1/tasks','POST',{'title':'HTTP end-to-end work','assigned_employee_ids':[3],'start_date':date.today().isoformat(),'deadline':(date.today()+timedelta(days=2)).isoformat(),'description':'A real request through the session and CSRF boundary.'})
            login(3)
            for status in ['Accepted','In Progress']:
                call(f'/api/v1/tasks/{task["id"]}/status','PATCH',{'status':status,'progress':50})
            links=[f'https://www.facebook.com/example/posts/{i+1}' for i in range(15)]
            report=call('/api/v1/reports','POST',{'task_id':task['id'],'report_date':date.today().isoformat(),'work_description':'បានធ្វើការតាមផែនការ','expected_output':'10 records','actual_output':'5 records','evidence_url':'\n'.join(links),'quantity_target':10,'quantity_completed':5,'start_time':'08:30','end_time':'11:00'})
            assert report['progress']==50 and report['total_hours']==2.5
            assert report['evidence_url'].splitlines()==links
            call(f'/api/v1/reports/{report["id"]}/submit','POST',{})
            login(2)
            assert call(f'/api/v1/reports/{report["id"]}')['evidence_url'].splitlines()==links
            call(f'/api/v1/reports/{report["id"]}/request-revision','POST',{'feedback':'Please finish the remaining records.'})
            login(3)
            call(f'/api/v1/reports/{report["id"]}','PATCH',{'quantity_completed':10,'actual_output':'10 records'})
            call(f'/api/v1/reports/{report["id"]}/submit','POST',{})
            call(f'/api/v1/tasks/{task["id"]}/status','PATCH',{'status':'Pending Review','progress':100})
            login(2)
            assert call(f'/api/v1/reports/{report["id"]}/approve','POST',{'feedback':'Verified'})['status']=='Approved'
            call(f'/api/v1/tasks/{task["id"]}/status','PATCH',{'status':'Completed'})
            metrics=call('/api/v1/dashboard/manager')
            assert metrics['completed']==1 and metrics['approved']==1 and metrics['hours']==2.5
            assert call('/api/v1/exports/reports.csv').startswith(b'\xef\xbb\xbf')
            assert call('/api/v1/exports/reports.xlsx').startswith(b'PK')
            assert call('/api/v1/exports/reports.pdf').startswith(b'%PDF-')
            call('/api/v1/auth/logout','POST',{})
            print('PASS: real HTTP, CSRF, session login, scoped assignment, task transitions, Khmer daily report, revision, resubmission, approval, completion, database metrics, CSV/XLSX/Khmer PDF and logout.')
        finally:
            server.shutdown()
            server.server_close()
            worker.join(timeout=5)
            with app.app_context():
                db.session.remove()
                db.engine.dispose()


if __name__=='__main__':
    main()
