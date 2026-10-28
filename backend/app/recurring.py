"""Generate one independent task per template per local day, safely on retries."""
import secrets
from pathlib import Path
from flask import current_app
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from .extensions import db
from .models import Task, User, TaskAssignment, DailyTaskOccurrence, Attachment, AuditLog
from .services import today, notify, STAFF

COPY_FIELDS = ('title', 'description', 'category_id', 'department_id', 'creator_id',
               'priority', 'completion_criteria', 'estimated_hours', 'internal_notes', 'work_links')


def allowed_assignees(source, creator):
    users = [assignment.user for assignment in source.assignments]
    return [user for user in users if user.active and (
        creator.role in ('super_admin', 'admin') or user.id == creator.id
        or (user.manager_id == creator.id and user.role in STAFF))]


def copy_attachments(source_id, task):
    for original in Attachment.query.filter_by(task_id=source_id):
        data = original.data
        if data is None:
            folder = Path(current_app.config['UPLOAD_FOLDER']).resolve()
            path = (folder / original.storage_name).resolve()
            if not path.is_relative_to(folder) or not path.is_file():
                current_app.logger.warning('Missing attachment %s on recurring task %s', original.id, source_id)
                continue
            data = path.read_bytes()
        db.session.add(Attachment(task_id=task.id, owner_id=task.creator_id,
            filename=original.filename, storage_name=secrets.token_hex(24),
            mime=original.mime, size=len(data), data=data))


def generate_daily_tasks(viewer=None):
    """Create today's occurrences only; never manufacture historical work.

    The first source task is already the first day's occurrence. Completing it
    does not stop future days. Archive, cancel, untick repeat, or its end date do.
    A request generates only templates relevant to its authenticated user; the
    optional worker/CLI generates all templates without requiring browser use.
    """
    day = today()
    query = Task.query.filter(Task.repeat_daily.is_(True), Task.archived.is_(False),
        Task.status != 'Cancelled', Task.start_date < day,
        or_(Task.repeat_until.is_(None), Task.repeat_until >= day))
    if viewer and viewer.role not in ('super_admin', 'admin'):
        query = query.filter(or_(Task.creator_id == viewer.id,
            Task.assignments.any(TaskAssignment.user_id == viewer.id)))
    created = 0
    for source in query.order_by(Task.id).all():
        creator = db.session.get(User, source.creator_id)
        if not creator or not creator.active or creator.role in STAFF:
            continue
        # Generated tasks can never become another repeating template.
        if source.daily_occurrence is not None:
            continue
        users = allowed_assignees(source, creator)
        if not users or DailyTaskOccurrence.query.filter_by(source_task_id=source.id, run_date=day).first():
            continue
        try:
            with db.session.begin_nested():
                task = Task(**{key: getattr(source, key) for key in COPY_FIELDS},
                    start_date=day, deadline=day + (source.deadline - source.start_date),
                    status='Assigned', repeat_daily=False, archived=False)
                db.session.add(task)
                db.session.flush()
                # This unique insert serializes competing workers before side effects.
                db.session.add(DailyTaskOccurrence(source_task_id=source.id, task_id=task.id, run_date=day))
                db.session.flush()
                for user in users:
                    db.session.add(TaskAssignment(task_id=task.id, user_id=user.id, progress=0))
                    notify(user.id, f'New task assigned: {task.title}', f'/tasks/{task.id}')
                copy_attachments(source.id, task)
                db.session.add(AuditLog(actor_id=creator.id, entity='task', entity_id=task.id,
                    action='daily_task_created', details={'source_task_id': source.id, 'run_date': day.isoformat()}))
            created += 1
        except IntegrityError:
            # Losing the unique-date race rolls back the entire copied task,
            # assignments, attachments and notices, leaving the caller usable.
            if not DailyTaskOccurrence.query.filter_by(source_task_id=source.id, run_date=day).first():
                raise
    if created:
        db.session.commit()
    return created
