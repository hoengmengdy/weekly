from app.extensions import db
from app.models import AuditLog, DailyReport, Notification, ReportReview


def create_report(client, sign_in, report_data, submit=False):
    sign_in(3)
    report = client.post('/api/v1/reports', json=report_data).json
    if submit:
        assert client.post(f'/api/v1/reports/{report["id"]}/submit').status_code == 200
    return report['id']


def test_author_deletes_own_draft(app, client, sign_in, report_data):
    id = create_report(client, sign_in, report_data)
    assert client.delete(f'/api/v1/reports/{id}').status_code == 200
    assert client.get(f'/api/v1/reports/{id}').status_code == 404
    with app.app_context():
        assert db.session.get(DailyReport, id) is None
        assert ReportReview.query.filter_by(report_id=id).count() == 0
        assert AuditLog.query.filter_by(entity='report', entity_id=id, action='deleted').count() == 1


def test_author_cannot_delete_submitted_report(client, sign_in, report_data):
    id = create_report(client, sign_in, report_data, submit=True)
    assert client.delete(f'/api/v1/reports/{id}').status_code == 403


def test_manager_cannot_delete_team_report(client, sign_in, report_data):
    id = create_report(client, sign_in, report_data, submit=True)
    sign_in(2)
    assert client.delete(f'/api/v1/reports/{id}').status_code == 403


def test_other_employee_cannot_see_or_delete(client, sign_in, report_data):
    id = create_report(client, sign_in, report_data)
    sign_in(4)
    assert client.delete(f'/api/v1/reports/{id}').status_code == 404


def test_admin_deletes_reviewed_report_with_history(app, client, sign_in, report_data):
    id = create_report(client, sign_in, report_data, submit=True)
    sign_in(2)
    assert client.post(f'/api/v1/reports/{id}/approve', json={'feedback': 'Good'}).status_code == 200
    sign_in(6)
    assert client.delete(f'/api/v1/reports/{id}').status_code == 200
    with app.app_context():
        assert db.session.get(DailyReport, id) is None
        assert ReportReview.query.filter_by(report_id=id).count() == 0
        assert Notification.query.filter_by(link=f'/reports/{id}').count() == 0
