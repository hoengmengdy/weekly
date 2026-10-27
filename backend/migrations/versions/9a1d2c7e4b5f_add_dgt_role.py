"""add DGT role

Revision ID: 9a1d2c7e4b5f
Revises: 4ff80268d6eb
Create Date: 2026-10-27 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9a1d2c7e4b5f'
down_revision = '4ff80268d6eb'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('user_role', type_='check')
        batch_op.create_check_constraint('user_role', "role IN ('super_admin','admin','manager','employee','DGT')")


def downgrade():
    op.execute("UPDATE users SET role = 'employee' WHERE role = 'DGT'")
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('user_role', type_='check')
        batch_op.create_check_constraint('user_role', "role IN ('super_admin','admin','manager','employee')")
