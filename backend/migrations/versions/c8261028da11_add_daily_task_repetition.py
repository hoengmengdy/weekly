"""Daily task repetition and an idempotency ledger.

Revision ID: c8261028da11
Revises: b0ed204147dd
"""
from alembic import op
import sqlalchemy as sa

revision = 'c8261028da11'
down_revision = 'b0ed204147dd'
branch_labels = None
depends_on = None


def upgrade():
    # Additive operations preserve SQLite task/report/attachment foreign keys.
    op.add_column('tasks', sa.Column('repeat_daily', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('tasks', sa.Column('repeat_until', sa.Date(), nullable=True))
    op.create_index('ix_tasks_repeat_daily', 'tasks', ['repeat_daily'])
    op.create_table('daily_task_occurrences',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('source_task_id', sa.Integer(), sa.ForeignKey('tasks.id'), nullable=False),
        sa.Column('task_id', sa.Integer(), sa.ForeignKey('tasks.id'), nullable=False, unique=True),
        sa.Column('run_date', sa.Date(), nullable=False),
        sa.UniqueConstraint('source_task_id', 'run_date', name='unique_daily_task_occurrence'),
    )


def downgrade():
    op.drop_table('daily_task_occurrences')
    op.drop_index('ix_tasks_repeat_daily', table_name='tasks')
    op.drop_column('tasks', 'repeat_until')
    op.drop_column('tasks', 'repeat_daily')
