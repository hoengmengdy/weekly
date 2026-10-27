from datetime import date
from app.extensions import db
from app.models import Category, Task

BASE='/api/v1'


def test_super_admin_deletes_category_and_tasks_keep_going(client,app,sign_in):
    sign_in(1)
    category=client.post(BASE+'/categories',json={'name':'Bun heng'}).json['id']
    today=date.today().isoformat()
    task=client.post(BASE+'/tasks',json={'title':'Poster','start_date':today,'deadline':today,'priority':'Medium','assigned_employee_ids':[3],'category_id':category}).json['id']
    sign_in(2)
    assert client.delete(BASE+f'/categories/{category}').status_code==403
    sign_in(1)
    assert client.delete(BASE+f'/categories/{category}').status_code==200
    with app.app_context():
        assert db.session.get(Category,category) is None
        assert db.session.get(Task,task).category_id is None
    assert client.delete(BASE+f'/categories/{category}').status_code==404
