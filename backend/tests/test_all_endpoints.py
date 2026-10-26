"""Every read endpoint, for every role, with every filter: none may fail with a server error.

Run on PostgreSQL with scripts/test_postgres.py; SQLite tolerates type mismatches that
PostgreSQL rejects, which is how /tasks?employee=<id> broke in production.
"""
import pytest

FILTERS = 'department=1&manager=2&employee=3&category=1&task=1&priority=Medium&date_from=2026-01-01&date_to=2030-12-31&q=e'
GETS = [
    '/auth/me', '/auth/csrf',
    '/employees', '/employees?department=1&role=employee&active=true&q=Per', '/employees/3',
    '/tasks', f'/tasks?{FILTERS}&status=Assigned&overdue=true', '/tasks?archived=true', '/tasks/1', '/tasks/1/history',
    '/reports', f'/reports?{FILTERS}&report_status=Approved&task_status=In%20Progress', '/reports?sort=date',
    '/dashboard/employee', '/dashboard/manager',
    '/analytics/performance', f'/analytics/performance?{FILTERS}&task_status=Assigned',
    '/analytics/performance?period=weekly', '/analytics/performance?period=monthly', '/analytics/task-summary',
    '/notifications', '/notifications?unread=true',
    '/audit-logs', '/departments', '/categories', '/settings',
    '/exports/reports.csv', f'/exports/reports.xlsx?{FILTERS}', '/exports/reports.pdf?department=1',
]


@pytest.fixture
def populated(client, sign_in, report_data):
    sign_in(3)
    id = client.post('/api/v1/reports', json=report_data).json['id']
    assert client.post(f'/api/v1/reports/{id}/submit').status_code == 200
    sign_in(2)
    assert client.post(f'/api/v1/reports/{id}/approve', json={'feedback': 'Verified'}).status_code == 200
    assert client.post('/api/v1/tasks/1/comments', json={'body': 'Checked'}).status_code in (200, 201)
    return id


@pytest.mark.parametrize('user', [1, 2, 3, 4, 6])
def test_every_read_endpoint_without_server_errors(client, sign_in, populated, user):
    sign_in(user)
    failures = []
    for path in GETS + [f'/reports/{populated}']:
        response = client.get('/api/v1' + path)
        if response.status_code >= 500:
            failures.append(f'{path} -> {response.status_code}')
    assert not failures, failures
