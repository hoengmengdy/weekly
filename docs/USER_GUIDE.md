# User guide

Work-link input accepts up to 15 links, one per line. Pasted bullets and numbered-list prefixes are removed automatically. Bare domains such as `www.facebook.com/...` receive `https://`. Each link is then checked for HTTP/HTTPS format, length and embedded credentials.

## Roles

| Role | Access |
| --- | --- |
| Super admin | All records; create/update users, roles, departments/categories and company name; reopen approved reports; audit log |
| Admin | All tasks/reports and analytics; assignments, review and exports; cannot modify user roles or system configuration |
| Manager | Self and directly managed employees; tasks within that team; creates and reviews team work |
| Employee | Own assigned tasks, own progress, own reports, own notifications and exports |

A manager's membership is determined by each employee's Manager field. Cross-team shared tasks are created by an admin; a manager cannot edit tasks containing other managers' employees. Inactive accounts cannot sign in, and existing sessions stop working immediately. Users cannot approve their own reports. Super admins cannot deactivate or demote themselves.

## Tasks

Use Tasks → New task. Select assignees (Ctrl/Cmd-click in the desktop multiple-selection list), dates, priority and completion criteria. Deadline cannot precede start date. Estimated hours must be nonnegative. Task details contains attachments, comments, each visible assignee's progress, and task history. Employees see only their own assignment progress; manager-only internal notes are hidden from them.

Transitions:

`Assigned → Accepted → In Progress → Pending Review → Completed`

The manager may request a task revision from Pending Review, then the assignee returns to In Progress or Pending Review. A manager can cancel an open task. Employees cannot mark a task completed, cancel it, or request revisions. Completed/cancelled tasks are closed. Archive hides a task from the active list while keeping history; select Archived to find it. Duplicate creates a new Assigned task and records its source.

Task status is shared by the task's assignees. Progress belongs to each assignment; a manager sees the average. Completing the task sets all assignments to 100%. A report's progress is a daily measurement and does not silently complete a task.

## Daily reports

Create a report for a task assigned to you. Multiple reports per day are supported. Drafts can be incomplete; submitting requires work description, expected output, actual output, a valid date and working times. Future report dates are rejected.

When quantity target is supplied, progress is `min(100, completed / target × 100)`. Target must be positive; completed quantity cannot be negative. Without a target, enter progress from 0 to 100. Hours are calculated by the server. Equal start/end times are invalid. Overnight work requires `ALLOW_OVERNIGHT=true`; then an earlier end time means the following day.

Save the draft, upload evidence in report details, then Submit report. Allowed evidence: PDF, PNG, JPEG, DOCX and XLSX. The default maximum request size is 10 MiB. Executables, malformed formats and macro-bearing Office files are rejected. Download links require an authenticated account with permission for the parent report or task.

Use **Facebook / work link** (តំណ Facebook / លទ្ធផលការងារ) to paste the published Facebook post or another completed-work URL. This optional field accepts HTTP/HTTPS links. The report author and authorized reviewer can open the link in a new tab from report details. The URL is retained in review snapshots and exports. Submitting the report sends the existing in-app notification to the task creator.

Submitted reports are locked. A manager can Start review, then Approve or Request revision. Revisions require feedback. The author can edit and resubmit a report marked Revision Requested. Approval locks it. Only a super admin can Reopen an approved report with a reason; every review and pre-edit version is retained in Review history. Reopening never deletes the approved snapshot.

## Analytics and notifications

Use employee, department, manager, date, category, priority, task-status and report-status filters. Report date ranges apply to reports; task metric date ranges apply to task deadlines. Cancelled and archived tasks do not lower completion rates. Draft report hours do not contribute to submitted-work totals. Team department charts count assignments, so a multi-assignee task can count more than once in those charts; the overall task card counts unique tasks.

CSV, Excel and PDF exports apply the same report filters and authorization as the report list. An export includes report details and feedback, company name, generated time, filters and summary counts. Exports are limited to 10,000 reports; narrow the filters for larger datasets. Output quantities across tasks can use different units; interpret them in context rather than as a quality score. CSV/Excel text is protected from formula injection.

Assignment, comment, submission, approval, revision and reassignment actions create persistent notifications. The scheduled `notify-deadlines` CLI command creates due-soon/overdue notices. Notifications can be marked as read. Deadline changes produce new notices without erasing prior history.

## Profile and language

Profile & settings lets you update your name, phone, position, profile photo and password. Passwords require at least 12 characters. Changing a password revokes other sessions; signing out revokes all existing sessions for that user. Forgot password requires configured SMTP. Reset links expire after 30 minutes and work once.

The language button toggles Khmer and English and remembers the preference on this browser. Dates/times are displayed in Asia/Phnom_Penh (UTC+7). The mobile menu exposes the same navigation. All forms have input labels and keyboard focus indicators; statuses use text as well as color. Print buttons create a clean, navigation-free page.
