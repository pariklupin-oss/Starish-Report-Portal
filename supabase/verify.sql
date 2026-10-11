-- Run after importing data into the staging project.
-- Compare these results with counts/totals recorded from the source Google Sheets.

select module, report_date, count(*) as rows
from public.production_reports
group by module, report_date
order by module, report_date;

select module, count(*) as rows,
       min(report_date) as first_date, max(report_date) as last_date
from public.production_reports
group by module
order by module;

select status, count(*) as tasks
from public.tasks
group by status
order by status;

select due_date, count(*) as tasks,
       count(*) filter (where status = 'Completed') as completed,
       count(*) filter (where status = 'Pending') as pending
from public.tasks
group by due_date
order by due_date desc;

select status, count(*) as complaints
from public.maintenance_complaints
group by status
order by status;

select u.full_name, count(*) as assigned_tasks
from public.tasks t
join public.users u on u.id = t.assigned_to
group by u.id, u.full_name
order by u.full_name;

select u.full_name,
       round(sum(extract(epoch from (l.ended_at - l.started_at))) / 3600.0, 2) as logged_hours
from public.maintenance_work_logs l
join public.users u on u.id = l.employee_id
where l.ended_at is not null
group by u.id, u.full_name
order by u.full_name;

-- Source-specific report totals depend on actual sheet headers. Once those are
-- mapped into payload, compare the relevant numeric JSON fields to source totals.
-- Example (replace the field key with the verified source header):
-- select sum((payload ->> 'Actual Quantity')::numeric)
-- from public.production_reports
-- where module = 'Printing Production';
