import hashlib
import io
import csv
from datetime import datetime, timedelta, timezone
from functools import wraps
from zoneinfo import ZoneInfo
from flask import abort, current_app, g, request, session
from pydantic import ValidationError
from sqlalchemy import or_
from .extensions import db
from .models import User, Task, TaskAssignment, DailyReport, AuditLog, Notification, ReportReview, Setting, now


def today():
    # UTC+7 is fixed; no OS timezone database dependency is required on Windows.
    return datetime.now(timezone(timedelta(hours=7))).date()


def parse(schema, data=None):
    try:
        return schema.model_validate(request.get_json(silent=True) if data is None else data)
    except ValidationError as error:
        abort(422, description='; '.join(f'{".".join(map(str, e["loc"]))}: {e["msg"]}' for e in error.errors()))


def authenticated(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        user = db.session.get(User, session.get('uid')) if session.get('uid') else None
        if not user or not user.active or session.get('version') != user.session_version:
            session.clear()
            abort(401, description='Please sign in.')
        g.user = user
        return fn(*args, **kwargs)
    return wrapped


def privileged():
    return g.user.role in ('super_admin', 'admin')


def require_manager():
    if g.user.role == 'employee':
        abort(403, description='Manager permission required.')


def require_super():
    if g.user.role != 'super_admin':
        abort(403, description='Super admin permission required.')


def can_manage(user):
    return privileged() or (g.user.role == 'manager' and user.manager_id == g.user.id and user.role == 'employee')


def scoped_users():
    query = User.query
    if privileged():
        return query
    if g.user.role == 'manager':
        return query.filter(or_(db.and_(User.manager_id == g.user.id, User.role == 'employee'), User.id == g.user.id))
    return query.filter(User.id == g.user.id)


def scoped_tasks():
    query = Task.query
    if privileged():
        return query
    visible_ids = [u.id for u in scoped_users().all()]
    if g.user.role == 'manager':
        # Team tasks are visible only when every assignee belongs to that manager.
        outside = db.select(TaskAssignment.task_id).where(~TaskAssignment.user_id.in_(visible_ids))
        return query.filter(~Task.id.in_(outside), or_(Task.creator_id == g.user.id,
                            Task.assignments.any(TaskAssignment.user_id.in_(visible_ids))))
    return query.filter(Task.assignments.any(TaskAssignment.user_id == g.user.id))


def scoped_reports():
    query = DailyReport.query
    if privileged():
        return query
    if g.user.role == 'manager':
        return query.filter(DailyReport.user_id.in_([u.id for u in scoped_users().all()]))
    return query.filter(DailyReport.user_id == g.user.id)


def task_or_404(id):
    return scoped_tasks().filter_by(id=id).first_or_404()


def report_or_404(id):
    return scoped_reports().filter_by(id=id).first_or_404()


def editable_task(task):
    require_manager()
    if task.archived:
        abort(409, description='Archived tasks cannot be changed.')
    if not privileged() and task.creator_id != g.user.id:
        abort(403, description='Only the task creator can change this task.')


def audit(entity, id, action, details=None):
    db.session.add(AuditLog(actor_id=g.user.id, entity=entity, entity_id=id, action=action, details=details or {}))


def notify(uid, message, link):
    db.session.add(Notification(user_id=uid, message=message, link=link))


def iso(value):
    if not value:
        return None
    if isinstance(value, datetime) and value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def user_json(user):
    return {key: getattr(user, key) for key in ('id','employee_id','full_name','username','email','phone','position','department_id','manager_id','role','active','profile_image_id')} | {
        'department': user.department.name if user.department else None, 'date_joined': iso(user.date_joined)}


def task_json(task, detail=False):
    assignments = task.assignments
    if g.user.role == 'employee':
        assignments = [a for a in assignments if a.user_id == g.user.id]
    data = {key: getattr(task, key) for key in ('id','title','description','category_id','department_id','creator_id','priority','status','completion_criteria','estimated_hours','archived')}
    data.update(start_date=iso(task.start_date), deadline=iso(task.deadline), created_at=iso(task.created_at),
                progress=round(sum(a.progress for a in assignments) / len(assignments), 1) if assignments else 0,
                overdue=task.deadline < today() and task.status not in ('Completed','Cancelled'),
                assignments=[{'user_id': a.user_id, 'full_name': a.user.full_name, 'progress': a.progress} for a in assignments])
    if g.user.role != 'employee':
        data['internal_notes'] = task.internal_notes
    if detail:
        from .models import Attachment, TaskComment
        data['attachments'] = [attachment_json(a) for a in Attachment.query.filter_by(task_id=task.id)]
        data['comments'] = [{'id': c.id, 'body': c.body, 'name': c.user.full_name, 'created_at': iso(c.created_at)} for c in TaskComment.query.filter_by(task_id=task.id).order_by(TaskComment.id)]
    return data


def attachment_json(a):
    return {'id': a.id, 'filename': a.filename, 'size': a.size, 'mime': a.mime, 'url': f'/api/v1/attachments/{a.id}'}


def report_json(report, detail=False):
    data = {column.name: getattr(report, column.name) for column in DailyReport.__table__.columns}
    for key in ('created_at','updated_at','submitted_at','report_date'):
        data[key] = iso(data[key])
    data.update(employee_name=report.user.full_name, task_title=report.task.title,
                department=report.user.department.name if report.user.department else '',
                attachments=[attachment_json(a) for a in report.attachments])
    if detail:
        data['reviews'] = [{'id': r.id, 'reviewer': r.reviewer.full_name, 'action': r.action, 'feedback': r.feedback,
                            'created_at': iso(r.created_at), 'snapshot': r.snapshot} for r in report.reviews]
    return data


def review_record(report, action, feedback=''):
    db.session.add(ReportReview(report_id=report.id, reviewer_id=g.user.id, action=action,
                               feedback=feedback, snapshot=report_json(report)))
    audit('report', report.id, action, {'feedback': feedback})


def apply_report(report, data):
    values = data.model_dump()
    if data.report_date > today():
        abort(422, description='Report date cannot be in the future.')
    start = datetime.strptime(data.start_time, '%H:%M')
    end = datetime.strptime(data.end_time, '%H:%M')
    if end == start:
        abort(422, description='Start and end time cannot be equal.')
    if end < start:
        if not current_app.config['ALLOW_OVERNIGHT']:
            abort(422, description='Overnight work is disabled by system policy.')
        end += timedelta(days=1)
    values['total_hours'] = round((end-start).total_seconds()/3600, 2)
    if data.quantity_target:
        values['progress'] = round(min(100, data.quantity_completed/data.quantity_target*100), 2)
    for key, value in values.items():
        setattr(report, key, value)


def filter_value(param, column):
    # Query strings are text; PostgreSQL (unlike SQLite) refuses to compare text with integer columns.
    value = request.args[param]
    if column.type.python_type is int:
        try:
            return int(value)
        except ValueError:
            abort(422, description=f'Invalid {param} filter')
    return value


def report_filters(query):
    for param, column in [('employee', DailyReport.user_id), ('task', DailyReport.task_id), ('report_status', DailyReport.status)]:
        if request.args.get(param):
            query = query.filter(column == filter_value(param, column))
    query = query.join(User, DailyReport.user_id == User.id).join(Task, DailyReport.task_id == Task.id)
    for param, column in [('department',User.department_id), ('manager',User.manager_id), ('category',Task.category_id), ('priority',Task.priority), ('task_status',Task.status)]:
        if request.args.get(param):
            query = query.filter(column == filter_value(param, column))
    for param, compare in [('date_from', 'ge'), ('date_to', 'le')]:
        if request.args.get(param):
            try:
                value = datetime.strptime(request.args[param], '%Y-%m-%d').date()
            except ValueError:
                abort(422, description='Invalid date filter')
            query = query.filter(DailyReport.report_date >= value) if compare == 'ge' else query.filter(DailyReport.report_date <= value)
    if request.args.get('q'):
        term = '%' + request.args['q'][:200] + '%'
        query = query.filter(or_(Task.title.ilike(term), User.full_name.ilike(term), DailyReport.work_description.ilike(term)))
    return query


def task_filters(query):
    query = query.filter(Task.archived == (request.args.get('archived') == 'true'))
    for param, column in [('status',Task.status), ('department',Task.department_id), ('priority',Task.priority), ('category',Task.category_id)]:
        if request.args.get(param):
            query = query.filter(column == filter_value(param, column))
    if request.args.get('employee'):
        query = query.filter(Task.assignments.any(TaskAssignment.user_id == filter_value('employee', TaskAssignment.user_id)))
    if request.args.get('manager'):
        query = query.filter(Task.assignments.any(TaskAssignment.user.has(manager_id=filter_value('manager', User.manager_id))))
    for param, before in [('date_from',False),('date_to',True)]:
        if request.args.get(param):
            try:
                value = datetime.strptime(request.args[param], '%Y-%m-%d').date()
            except ValueError:
                abort(422, description='Invalid date filter')
            query = query.filter(Task.deadline <= value) if before else query.filter(Task.deadline >= value)
    if request.args.get('q'):
        query = query.filter(Task.title.ilike('%' + request.args['q'][:200] + '%'))
    if request.args.get('overdue') == 'true':
        query = query.filter(Task.deadline < today(), Task.status.notin_(['Completed','Cancelled']))
    return query


def paginate(query, serializer, sorts=None):
    try:
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(100, max(1, int(request.args.get('per_page', 20))))
    except ValueError:
        abort(422, description='Invalid pagination')
    if sorts:
        sort = request.args.get('sort', 'newest')
        if sort not in sorts:
            abort(422, description='Invalid sorting option')
        query = query.order_by(sorts[sort])
    result = query.paginate(page=page, per_page=per_page, error_out=False)
    return {'items': [serializer(row) for row in result.items], 'total': result.total,
            'page': page, 'pages': result.pages, 'per_page': per_page}


def generate_deadline_notifications():
    count = 0
    for task in Task.query.filter(Task.archived.is_(False), Task.status.notin_(['Completed','Cancelled']), Task.deadline <= today()+timedelta(days=2)):
        kind = 'overdue' if task.deadline < today() else 'due soon'
        for assignment in task.assignments:
            key = f'{task.id}:{assignment.user_id}:{task.deadline}:{kind}'
            if not Notification.query.filter_by(dedupe_key=key).first():
                db.session.add(Notification(user_id=assignment.user_id, message=f'{task.title} is {kind}.', link=f'/tasks/{task.id}', dedupe_key=key))
                count += 1
    db.session.commit()
    return count


def analytics():
    tasks_query = task_filters(scoped_tasks())
    if request.args.get('task_status'):
        tasks_query = tasks_query.filter(Task.status == request.args['task_status'])
    tasks = tasks_query.all()
    reports = report_filters(scoped_reports()).all()
    users = scoped_users().all()
    if request.args.get('employee'):
        users = [u for u in users if str(u.id) == request.args['employee']]
    if request.args.get('department'):
        users = [u for u in users if str(u.department_id) == request.args['department']]
    if request.args.get('manager'):
        users = [u for u in users if str(u.manager_id) == request.args['manager']]
    eligible = [t for t in tasks if t.status != 'Cancelled']
    completed = sum(t.status == 'Completed' for t in eligible)
    rows = []
    for u in users:
        ut = [t for t in eligible if any(a.user_id == u.id for a in t.assignments)]
        ur = [r for r in reports if r.user_id == u.id]
        done = sum(t.status == 'Completed' for t in ut)
        rows.append({'id':u.id, 'name':u.full_name, 'department':u.department.name if u.department else 'Unassigned',
                     'assigned':len(ut), 'completed':done, 'incomplete':len(ut)-done,
                     'overdue':sum(t.deadline < today() and t.status != 'Completed' for t in ut),
                     'completion_rate':round(done/len(ut)*100,1) if ut else 0,
                     'reports_submitted':sum(r.status != 'Draft' for r in ur),
                     'approved':sum(r.status == 'Approved' for r in ur),
                     'revisions':sum(r.status == 'Revision Requested' for r in ur),
                     'hours':round(sum(r.total_hours for r in ur if r.status != 'Draft'),2),
                     'target':sum(r.quantity_target or 0 for r in ur if r.status != 'Draft'),
                     'actual':sum(r.quantity_completed for r in ur if r.status != 'Draft')})
    trend = []
    bucket = request.args.get('period', 'daily')
    groups = {}
    for r in reports:
        if r.status == 'Draft':
            continue
        day = r.report_date
        if bucket == 'weekly':
            day -= timedelta(days=day.weekday())
        elif bucket == 'monthly':
            day = day.replace(day=1)
        key = day.isoformat()
        groups.setdefault(key, {'date':key,'hours':0,'reports':0})
        groups[key]['hours'] += r.total_hours
        groups[key]['reports'] += 1
    trend = [groups[k] for k in sorted(groups)]
    return {'active_employees':sum(u.active for u in users), 'total_tasks':len(tasks),
            'completed':completed, 'in_progress':sum(t.status == 'In Progress' for t in tasks),
            'overdue':sum(t.deadline < today() and t.status not in ('Completed','Cancelled') for t in tasks),
            'today_assigned':sum(t.start_date == today() for t in tasks),
            'today_submitted':sum(r.report_date == today() and r.status != 'Draft' for r in reports),
            'awaiting_review':sum(r.status in ('Submitted','Under Review') for r in reports),
            'approved':sum(r.status == 'Approved' for r in reports),
            'revisions':sum(r.status == 'Revision Requested' for r in reports),
            'completion_rate':round(completed/len(eligible)*100,1) if eligible else 0,
            'hours':round(sum(r.total_hours for r in reports if r.status != 'Draft'),2),
            'employees':rows, 'trend':trend,
            'departments':[{'name':name,'assigned':sum(r['assigned'] for r in rows if r['department']==name), 'completed':sum(r['completed'] for r in rows if r['department']==name)} for name in sorted({r['department'] for r in rows})],
            'upcoming':[task_json(t) for t in sorted(eligible, key=lambda t:t.deadline) if t.status != 'Completed'][:5],
            'recent_feedback':[report_json(r) for r in sorted(reports,key=lambda r:r.id,reverse=True) if r.manager_feedback][:5]}
