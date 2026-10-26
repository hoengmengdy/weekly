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


def test_id_filters_are_integers_and_reject_text(client, sign_in):
    # PostgreSQL rejects comparing text query values with integer columns; filters must convert them.
    sign_in(3)
    tasks = client.get('/api/v1/tasks?employee=3')
    assert tasks.status_code == 200 and [t['id'] for t in tasks.json['items']] == [1]
    assert client.get('/api/v1/tasks?employee=abc').status_code == 422
    assert client.get('/api/v1/reports?task=1&employee=3').status_code == 200
    assert client.get('/api/v1/reports?department=x').status_code == 422
    sign_in(1)
    assert client.get('/api/v1/employees?department=1').status_code == 200


def test_report_photo_stored_in_database_and_shown_inline(app, client, sign_in, report_data, tmp_path):
    import io
    from PIL import Image
    from app.models import Attachment
    buffer = io.BytesIO()
    Image.new('RGB', (40, 30), (200, 120, 40)).save(buffer, 'JPEG')
    jpeg = buffer.getvalue()
    id = create_report(client, sign_in, report_data)
    upload = client.post(f'/api/v1/reports/{id}/attachments', data={'file': (io.BytesIO(jpeg), 'work.jpg')},
                         content_type='multipart/form-data')
    assert upload.status_code == 201 and upload.json['mime'] == 'image/jpeg'
    # Nothing is written to disk, so hosts without persistent storage keep the photo.
    assert not (tmp_path / 'uploads').exists() or not any((tmp_path / 'uploads').iterdir())
    inline = client.get(upload.json['url'] + '?inline=1')
    assert inline.status_code == 200 and inline.data == jpeg
    assert 'attachment' not in inline.headers.get('Content-Disposition', '')
    download = client.get(upload.json['url'])
    assert download.data == jpeg and 'attachment' in download.headers['Content-Disposition']
    assert client.get(f'/api/v1/reports/{id}').json['attachments'][0]['mime'] == 'image/jpeg'
    assert client.delete(f'/api/v1/reports/{id}').status_code == 200
    with app.app_context():
        assert Attachment.query.filter_by(report_id=id).count() == 0


def test_report_submits_without_description_and_outputs(client, sign_in, report_data):
    data = {**report_data, 'work_description': '', 'expected_output': '', 'actual_output': ''}
    sign_in(3)
    id = client.post('/api/v1/reports', json=data).json['id']
    submitted = client.post(f'/api/v1/reports/{id}/submit')
    assert submitted.status_code == 200 and submitted.json['status'] == 'Submitted'
