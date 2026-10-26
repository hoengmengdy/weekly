from datetime import datetime, timezone
from .extensions import db


def now():
    return datetime.now(timezone.utc)


class Base:
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime(timezone=True), default=now, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=now, onupdate=now, nullable=False)


class Department(Base, db.Model):
    __tablename__ = 'departments'
    name = db.Column(db.String(120), unique=True, nullable=False)
    description = db.Column(db.Text, default='', nullable=False)


class User(Base, db.Model):
    __tablename__ = 'users'
    employee_id = db.Column(db.String(40), unique=True, nullable=False)
    full_name = db.Column(db.String(160), nullable=False)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(254), unique=True, nullable=False)
    password_hash = db.Column(db.Text, nullable=False)
    phone = db.Column(db.String(40), default='')
    position = db.Column(db.String(120), default='')
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'), index=True)
    manager_id = db.Column(db.Integer, db.ForeignKey('users.id'), index=True)
    department = db.relationship('Department')
    role = db.Column(db.String(20), nullable=False, default='employee')
    active = db.Column(db.Boolean, nullable=False, default=True)
    date_joined = db.Column(db.Date, nullable=False)
    profile_image_id = db.Column(db.String(80))
    session_version = db.Column(db.Integer, nullable=False, default=1)
    __table_args__ = (db.CheckConstraint("role IN ('super_admin','admin','manager','employee')", name='user_role'),)


class Category(Base, db.Model):
    __tablename__ = 'task_categories'
    name = db.Column(db.String(100), unique=True, nullable=False)


class Task(Base, db.Model):
    __tablename__ = 'tasks'
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False, default='')
    category_id = db.Column(db.Integer, db.ForeignKey('task_categories.id'))
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'), index=True)
    creator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    deadline = db.Column(db.Date, nullable=False, index=True)
    priority = db.Column(db.String(20), nullable=False, default='Medium')
    status = db.Column(db.String(30), nullable=False, default='Assigned', index=True)
    completion_criteria = db.Column(db.Text, nullable=False, default='')
    estimated_hours = db.Column(db.Float, nullable=False, default=0)
    internal_notes = db.Column(db.Text, nullable=False, default='')
    work_links = db.Column(db.Text, nullable=False, default='', server_default='')
    archived = db.Column(db.Boolean, nullable=False, default=False)
    assignments = db.relationship('TaskAssignment', cascade='all, delete-orphan', backref='task')
    __table_args__ = (
        db.CheckConstraint('deadline >= start_date', name='task_dates'),
        db.CheckConstraint('estimated_hours >= 0', name='task_hours'),
        db.CheckConstraint("priority IN ('Low','Medium','High','Urgent')", name='task_priority'),
        db.CheckConstraint("status IN ('Assigned','Accepted','In Progress','Pending Review','Revision Requested','Completed','Cancelled')", name='task_status'),
    )


class TaskAssignment(Base, db.Model):
    __tablename__ = 'task_assignments'
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    progress = db.Column(db.Float, nullable=False, default=0)
    user = db.relationship('User')
    __table_args__ = (db.UniqueConstraint('task_id', 'user_id', name='unique_assignment'), db.CheckConstraint('progress >= 0 AND progress <= 100', name='assignment_progress'))


class DailyReport(Base, db.Model):
    __tablename__ = 'daily_reports'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False, index=True)
    report_date = db.Column(db.Date, nullable=False, index=True)
    work_description = db.Column(db.Text, default='', nullable=False)
    expected_output = db.Column(db.Text, default='', nullable=False)
    actual_output = db.Column(db.Text, default='', nullable=False)
    # SQLite does not enforce VARCHAR lengths. Retain its original declaration
    # to avoid rebuilding a report table referenced by immutable review history.
    evidence_url = db.Column(db.Text().with_variant(db.String(2048), 'sqlite'), default='', server_default='', nullable=False)
    quantity_target = db.Column(db.Float)
    quantity_completed = db.Column(db.Float, nullable=False, default=0)
    progress = db.Column(db.Float, nullable=False, default=0)
    start_time = db.Column(db.String(5), nullable=False, default='09:00')
    end_time = db.Column(db.String(5), nullable=False, default='17:00')
    total_hours = db.Column(db.Float, nullable=False, default=8)
    challenges = db.Column(db.Text, nullable=False, default='')
    solutions = db.Column(db.Text, nullable=False, default='')
    notes = db.Column(db.Text, nullable=False, default='')
    status = db.Column(db.String(30), nullable=False, default='Draft', index=True)
    manager_feedback = db.Column(db.Text, nullable=False, default='')
    submitted_at = db.Column(db.DateTime(timezone=True))
    user = db.relationship('User')
    task = db.relationship('Task')
    attachments = db.relationship('Attachment', backref='report', foreign_keys='Attachment.report_id')
    reviews = db.relationship('ReportReview', backref='report', order_by='ReportReview.id')
    __table_args__ = (
        db.CheckConstraint('progress >= 0 AND progress <= 100', name='report_progress'),
        db.CheckConstraint('quantity_target IS NULL OR quantity_target > 0', name='report_target'),
        db.CheckConstraint('quantity_completed >= 0', name='report_completed'),
        db.CheckConstraint('total_hours > 0 AND total_hours <= 24', name='report_hours'),
        db.CheckConstraint("status IN ('Draft','Submitted','Under Review','Revision Requested','Approved')", name='report_status'),
    )


class Attachment(Base, db.Model):
    __tablename__ = 'report_attachments'
    report_id = db.Column(db.Integer, db.ForeignKey('daily_reports.id'), index=True)
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), index=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    storage_name = db.Column(db.String(80), unique=True, nullable=False)
    mime = db.Column(db.String(100), nullable=False)
    size = db.Column(db.Integer, nullable=False)
    # File bytes; deferred so listing attachments never loads them. NULL for older disk-stored files.
    data = db.deferred(db.Column(db.LargeBinary))


class ReportReview(Base, db.Model):
    __tablename__ = 'report_reviews'
    report_id = db.Column(db.Integer, db.ForeignKey('daily_reports.id'), nullable=False, index=True)
    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(40), nullable=False)
    feedback = db.Column(db.Text, nullable=False, default='')
    snapshot = db.Column(db.JSON, nullable=False)
    reviewer = db.relationship('User')


class TaskComment(Base, db.Model):
    __tablename__ = 'task_comments'
    task_id = db.Column(db.Integer, db.ForeignKey('tasks.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    body = db.Column(db.Text, nullable=False)
    user = db.relationship('User')


class Notification(Base, db.Model):
    __tablename__ = 'notifications'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    message = db.Column(db.Text, nullable=False)
    link = db.Column(db.String(200), nullable=False, default='/')
    read = db.Column(db.Boolean, nullable=False, default=False)
    dedupe_key = db.Column(db.String(150), unique=True)


class AuditLog(Base, db.Model):
    __tablename__ = 'audit_logs'
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    entity = db.Column(db.String(40), nullable=False, index=True)
    entity_id = db.Column(db.Integer, nullable=False, index=True)
    action = db.Column(db.String(80), nullable=False)
    details = db.Column(db.JSON, nullable=False, default=dict)


class PasswordReset(Base, db.Model):
    __tablename__ = 'password_resets'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    token_hash = db.Column(db.String(64), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    used = db.Column(db.Boolean, nullable=False, default=False)


class Setting(db.Model):
    __tablename__ = 'system_settings'
    key = db.Column(db.String(80), primary_key=True)
    value = db.Column(db.JSON, nullable=False)
