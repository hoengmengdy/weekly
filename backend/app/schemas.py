from datetime import date, time
import re
from typing import Literal, Annotated
from pydantic import BaseModel, Field, EmailStr, ConfigDict, model_validator, field_validator, StringConstraints, HttpUrl, TypeAdapter

Roles = Literal['super_admin', 'admin', 'manager', 'employee', 'DGT']
TaskStatus = Literal['Assigned', 'Accepted', 'In Progress', 'Pending Review', 'Revision Requested', 'Completed', 'Cancelled']


class Schema(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True, allow_inf_nan=False)


class Login(Schema):
    username: str = Field(min_length=1, max_length=254)
    password: Annotated[str, StringConstraints(strip_whitespace=False)] = Field(min_length=1, max_length=200)


class EmployeeInput(Schema):
    employee_id: str = Field(min_length=1, max_length=40)
    full_name: str = Field(min_length=1, max_length=160)
    username: str = Field(min_length=2, max_length=80, pattern=r'^[a-zA-Z0-9_.-]+$')
    email: EmailStr
    password: Annotated[str, StringConstraints(strip_whitespace=False)] | None = Field(default=None, min_length=12, max_length=200)
    phone: str = Field(default='', max_length=40)
    position: str = Field(default='', max_length=120)
    department_id: int | None = None
    manager_id: int | None = None
    role: Roles = 'employee'
    active: bool = True
    date_joined: date = Field(default_factory=date.today)

    @field_validator('email')
    @classmethod
    def email_lowercase(cls, value):
        return str(value).lower()


class TaskInput(Schema):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default='', max_length=20000)
    category_id: int | None = None
    department_id: int | None = None
    assigned_employee_ids: list[int] = Field(min_length=1, max_length=100)
    start_date: date
    deadline: date
    priority: Literal['Low', 'Medium', 'High', 'Urgent'] = 'Medium'
    completion_criteria: str = Field(default='', max_length=10000)
    estimated_hours: float = Field(default=0, ge=0, le=100000)
    internal_notes: str = Field(default='', max_length=10000)
    work_links: str = Field(default='', max_length=30734)
    repeat_daily: bool = False
    repeat_until: date | None = None

    @field_validator('work_links')
    @classmethod
    def valid_work_links(cls, value):
        return clean_work_links(value)

    @model_validator(mode='after')
    def dates(self):
        if self.deadline < self.start_date:
            raise ValueError('Deadline must be on or after start date')
        if self.repeat_daily and self.repeat_until and self.repeat_until < self.start_date:
            raise ValueError('Repeat until must be on or after start date')
        if not self.repeat_daily:
            self.repeat_until = None
        if len(set(self.assigned_employee_ids)) != len(self.assigned_employee_ids):
            raise ValueError('Duplicate assignees')
        return self


class StatusInput(Schema):
    status: TaskStatus
    progress: float | None = Field(default=None, ge=0, le=100)


def clean_work_links(value):
    """Normalize pasted work links (bullets, missing https://) and allow at most 15, one per line."""
    links = [re.sub(r'^(?:[-*•]\s*|\d+[.)]\s+)', '', line.strip()) for line in value.splitlines()]
    links = [link for link in links if link]
    if len(links) > 15:
        raise ValueError('Add at most 15 work links, one per line')
    validated = []
    for link in links:
        if re.match(r'^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?:[/?#:]|$)', link, re.IGNORECASE):
            link = 'https://' + link
        url = TypeAdapter(HttpUrl).validate_python(link)
        if url.username or url.password:
            raise ValueError('Work links must not contain login credentials')
        if len(link) > 2048 or len(str(url)) > 2048:
            raise ValueError('Each work link must have at most 2048 characters')
        validated.append(str(url))
    return '\n'.join(validated)


class ReportInput(Schema):
    task_id: int
    report_date: date
    work_description: str = Field(default='', max_length=20000)
    expected_output: str = Field(default='', max_length=10000)
    actual_output: str = Field(default='', max_length=10000)
    evidence_url: str = Field(default='', max_length=30734)
    quantity_target: float | None = Field(default=None, gt=0, le=1e12)
    quantity_completed: float = Field(default=0, ge=0, le=1e12)
    progress: float = Field(default=0, ge=0, le=100)
    start_time: str = Field(default='09:00', pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    end_time: str = Field(default='17:00', pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    challenges: str = Field(default='', max_length=10000)
    solutions: str = Field(default='', max_length=10000)
    notes: str = Field(default='', max_length=10000)

    @field_validator('evidence_url')
    @classmethod
    def valid_evidence_url(cls, value):
        return clean_work_links(value)


class PortfolioInput(Schema):
    title: str = Field(min_length=1, max_length=200)
    kind: Literal['Poster', 'Video', 'Photo']
    work_date: date
    department_id: int | None = None
    user_id: int | None = None
    task_id: int | None = None
    link: str = Field(default='', max_length=2100)
    description: str = Field(default='', max_length=5000)
    needs_approval: bool = False

    @field_validator('link')
    @classmethod
    def valid_link(cls, value):
        links = clean_work_links(value)
        if '\n' in links:
            raise ValueError('Add one link only')
        return links


class Feedback(Schema):
    feedback: str = Field(default='', max_length=10000)


class NamedInput(Schema):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default='', max_length=2000)
