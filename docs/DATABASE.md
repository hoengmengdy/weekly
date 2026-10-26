# Database design

Production uses PostgreSQL through psycopg and SQLAlchemy. Local development and fast tests use SQLite with foreign keys enabled. Migration revision `b6e5ef0f3295` is the initial schema. Timestamps are stored in UTC; naive SQLite timestamps are serialized with an explicit UTC offset. Business report dates/deadlines use dates in UTC+7.

| Table | Relationships / rules |
| --- | --- |
| `departments` | Unique department name; referenced by users/tasks |
| `users` | Unique employee ID, username, email; department FK, self-referencing manager FK; role check; password hash and revocable session version |
| `task_categories` | Unique category name; referenced by tasks |
| `tasks` | Creator, category, department FKs; date ordering, hours, priority and status checks; archive flag |
| `task_assignments` | Unique (task, user); progress 0–100; removed assignment history retained by audit logs |
| `daily_reports` | Author/task FKs; report date; output, hours, progress; valid-status and numeric checks |
| `report_attachments` | Private storage names; report/task/owner FKs; original filename, MIME and size; also stores owner profile images |
| `report_reviews` | Reviewer/report FKs; action, feedback, immutable application-level JSON snapshot |
| `task_comments` | Task/author FKs and text |
| `notifications` | Recipient FK, read flag, internal link; unique deadline deduplication key |
| `audit_logs` | Actor FK, indexed entity/type IDs, action and structured before/after details |
| `password_resets` | User FK; unique token digest; expiry and used flag |
| `system_settings` | Key/value JSON settings (currently company name) |

All entity tables have integer primary keys and created/updated timestamps. FKs prevent accidental parent deletion. Task assignments cascade within the ORM when intentionally removed, but no public API hard-deletes business records. Archive/deactivation preserve work history. Mutations and their audit records/notifications commit in the same database transaction; failed validation/constraints roll back.

Lists are paginated in SQL, with indexes on ownership, parent IDs, status and deadlines. Allowed sort keys map to explicit columns. Input values never become SQL fragments. Manager/employee ownership predicates are applied before fetching, filtering, export generation, downloads and status changes. Report reviews acquire row locks on PostgreSQL to serialize conflicting review actions. Single-use reset tokens also acquire row locks.

Back up the PostgreSQL database and private upload volume together. Test restores and migration upgrades on a copy before production rollout. Do not edit audit/review rows through application-level endpoints; operational database administrators remain able to change records and must be controlled separately.
