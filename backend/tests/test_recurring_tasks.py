from datetime import date, timedelta
import pytest
from app import recurring
from app.extensions import db
from app.models import Task, TaskAssignment, DailyTaskOccurrence, User, Notification, Attachment, DailyReport

BASE = '/api/v1'
DAY = date(2026, 10, 28)


@pytest.fixture
def clock(monkeypatch):
    value = [DAY]
    monkeypatch.setattr(recurring, 'today', lambda: value[0])
    return value


def template(client, sign_in, **values):
    sign_in(2)
    response = client.post(BASE + '/tasks', json={
        'title': 'Post VDo', 'description': 'Publish daily work',
        'start_date': DAY.isoformat(), 'deadline': DAY.isoformat(),
        'assigned_employee_ids': [3], 'repeat_daily': True, 'priority': 'High',
        'completion_criteria': '15 work links', 'work_links': 'https://example.com/instructions',
        **values,
    })
    assert response.status_code == 201, response.json
    return response.json['id']


def test_once_per_day_and_independent_progress(client, app, sign_in, clock):
    source_id = template(client, sign_in)
    with app.app_context():
        assert recurring.generate_daily_tasks() == 0
        source = db.session.get(Task, source_id)
        source.status = 'Completed'
        source.assignments[0].progress = 100
        db.session.add(Attachment(task_id=source_id, owner_id=2, filename='guide.pdf',
            storage_name='source-guide', mime='application/pdf', size=5, data=b'guide'))
        db.session.commit()
        clock[0] += timedelta(days=1)
        assert recurring.generate_daily_tasks() == 1
        assert recurring.generate_daily_tasks() == 0
        occurrence = DailyTaskOccurrence.query.one()
        copied = db.session.get(Task, occurrence.task_id)
        assert occurrence.source_task_id == source_id
        assert copied.title == 'Post VDo' and copied.status == 'Assigned'
        assert copied.start_date == copied.deadline == clock[0]
        assert copied.priority == 'High' and copied.completion_criteria == '15 work links'
        assert copied.work_links == source.work_links
        assert copied.assignments[0].user_id == 3 and copied.assignments[0].progress == 0
        assert copied.repeat_daily is False
        assert Notification.query.filter_by(link=f'/tasks/{copied.id}').count() == 1
        attachment = Attachment.query.filter_by(task_id=copied.id).one()
        assert attachment.data == b'guide' and attachment.storage_name != 'source-guide'
        assert DailyReport.query.filter_by(task_id=copied.id).count() == 0
        clock[0] += timedelta(days=1)
        assert recurring.generate_daily_tasks() == 1
        assert DailyTaskOccurrence.query.count() == 2


def test_end_date_is_inclusive_no_future_or_historical_tasks(client, app, sign_in, clock):
    source_id = template(client, sign_in, repeat_until=(DAY + timedelta(days=1)).isoformat())
    with app.app_context():
        clock[0] = DAY - timedelta(days=1)
        assert recurring.generate_daily_tasks() == 0
        clock[0] = DAY + timedelta(days=1)
        assert recurring.generate_daily_tasks() == 1
        clock[0] += timedelta(days=4)
        assert recurring.generate_daily_tasks() == 0
        assert DailyTaskOccurrence.query.filter_by(source_task_id=source_id).count() == 1


@pytest.mark.parametrize('action', ['disable', 'archive', 'cancel'])
def test_stop_future_occurrences(client, app, sign_in, clock, action):
    source_id = template(client, sign_in)
    if action == 'disable':
        response = client.patch(f'{BASE}/tasks/{source_id}', json={'repeat_daily': False})
    elif action == 'archive':
        response = client.post(f'{BASE}/tasks/{source_id}/archive')
    else:
        response = client.patch(f'{BASE}/tasks/{source_id}/status', json={'status': 'Cancelled'})
    assert response.status_code == 200
    clock[0] += timedelta(days=1)
    with app.app_context():
        assert recurring.generate_daily_tasks() == 0
        assert db.session.get(Task, source_id) is not None


def test_employee_visit_generates_today_and_preserves_access(client, app, sign_in, clock):
    source_id = template(client, sign_in)
    clock[0] += timedelta(days=1)
    sign_in(4)
    assert client.get(BASE + '/tasks').status_code == 200
    with app.app_context():
        assert DailyTaskOccurrence.query.count() == 0
    sign_in(3)
    tasks = client.get(BASE + '/tasks').json['items']
    copied = next(task for task in tasks if task['recurrence_source_id'] == source_id)
    assert len(copied['assignments']) == 1 and copied['assignments'][0]['user_id'] == 3
    assert 'internal_notes' not in copied
    assert client.get(BASE + '/tasks').status_code == 200
    with app.app_context():
        assert DailyTaskOccurrence.query.count() == 1
    sign_in(4)
    assert client.get(f"{BASE}/tasks/{copied['id']}").status_code == 404


@pytest.mark.parametrize('change', ['inactive_assignee', 'reassigned', 'inactive_creator', 'demoted_creator'])
def test_current_permissions_are_rechecked(client, app, sign_in, clock, change):
    template(client, sign_in)
    with app.app_context():
        if change == 'inactive_assignee':
            db.session.get(User, 3).active = False
        elif change == 'reassigned':
            db.session.get(User, 3).manager_id = 5
        elif change == 'inactive_creator':
            db.session.get(User, 2).active = False
        else:
            db.session.get(User, 2).role = 'employee'
        db.session.commit()
        clock[0] += timedelta(days=1)
        assert recurring.generate_daily_tasks() == 0


def test_reject_invalid_dates_and_employees_cannot_schedule(client, sign_in, clock):
    sign_in(2)
    data = {'title': 'Daily', 'start_date': DAY.isoformat(), 'deadline': DAY.isoformat(),
        'assigned_employee_ids': [3], 'repeat_daily': True, 'repeat_until': '2026-10-27'}
    assert client.post(BASE + '/tasks', json=data).status_code == 422
    sign_in(3)
    assert client.post(BASE + '/tasks', json=data | {'repeat_until': None}).status_code == 403


def test_copies_do_not_start_their_own_schedules(client, app, sign_in, clock):
    source_id = template(client, sign_in)
    duplicate = client.post(f'{BASE}/tasks/{source_id}/duplicate').json
    assert duplicate['repeat_daily'] is False
    clock[0] += timedelta(days=1)
    with app.app_context():
        assert recurring.generate_daily_tasks() == 1
        generated_id = DailyTaskOccurrence.query.one().task_id
    assert client.patch(f'{BASE}/tasks/{generated_id}', json={'repeat_daily': True}).status_code == 422
    assert app.test_cli_runner().invoke(args=['generate-daily-tasks']).output == '0 daily tasks created.\n'


def test_repeated_occurrence_is_unique_in_database(client, app, sign_in, clock):
    from sqlalchemy.exc import IntegrityError
    source_id = template(client, sign_in)
    clock[0] += timedelta(days=1)
    with app.app_context():
        recurring.generate_daily_tasks()
        other = Task(title='Duplicate day', creator_id=2, start_date=clock[0], deadline=clock[0])
        db.session.add(other)
        db.session.flush()
        db.session.add(DailyTaskOccurrence(source_task_id=source_id, task_id=other.id, run_date=clock[0]))
        with pytest.raises(IntegrityError):
            db.session.flush()
        db.session.rollback()
        assert Task.query.filter_by(title='Duplicate day').count() == 0
        assert DailyTaskOccurrence.query.count() == 1


def test_losing_a_generation_race_rolls_back_the_whole_copy(client, app, sign_in, clock, monkeypatch):
    template(client, sign_in)
    clock[0] += timedelta(days=1)
    with app.app_context():
        assert recurring.generate_daily_tasks() == 1
        task_count = Task.query.count()
        notice_count = Notification.query.count()
        query_type = type(DailyTaskOccurrence.query)
        original_first = query_type.first
        stale = [True]
        def stale_initial_lookup(query):
            if stale[0] and query.column_descriptions[0]['entity'] is DailyTaskOccurrence:
                stale[0] = False
                return None  # another worker commits after our initial existence check
            return original_first(query)
        monkeypatch.setattr(query_type, 'first', stale_initial_lookup)
        assert recurring.generate_daily_tasks() == 0
        assert Task.query.count() == task_count
        assert Notification.query.count() == notice_count
        assert DailyTaskOccurrence.query.count() == 1


def test_additive_migration_preserves_tasks_assignments_and_reports(app, client, sign_in, report_data):
    from pathlib import Path
    from flask_migrate import stamp, downgrade, upgrade
    sign_in(3)
    report = client.post(BASE + '/reports', json=report_data)
    assert report.status_code == 201
    report_id = report.json['id']
    directory = str(Path(__file__).resolve().parents[1] / 'migrations')
    with app.app_context():
        db.session.add(Attachment(report_id=report_id, owner_id=3, filename='proof.pdf',
            storage_name='preserve-proof', mime='application/pdf', size=5, data=b'proof'))
        db.session.commit()
        db.session.remove()
        stamp(directory=directory, revision='c8261028da11')
        downgrade(directory=directory, revision='b0ed204147dd')
        assert db.session.execute(db.text('SELECT COUNT(*) FROM tasks')).scalar() == 2
        db.session.remove()
        upgrade(directory=directory)
        assert db.session.get(Task, 1).repeat_daily is False
        assert TaskAssignment.query.count() == 2
        assert db.session.get(DailyReport, report_id).actual_output == report_data['actual_output']
        assert Attachment.query.filter_by(storage_name='preserve-proof').one().data == b'proof'
        if db.engine.dialect.name == 'sqlite':
            assert db.session.execute(db.text('PRAGMA foreign_key_check')).all() == []
