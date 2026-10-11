// Staging example only. This module does not switch the live portal.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in local .env');
}

export const supabase = createClient(url, publishableKey);

export async function getMyTasks(date = new Date().toISOString().slice(0, 10)) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Sign in first');

  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, description, due_date, status, priority, department')
    .eq('assigned_to', user.id)
    .eq('due_date', date)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function setTaskComplete(taskId, complete) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Sign in first');

  const { data, error } = await supabase
    .from('tasks')
    .update({
      status: complete ? 'Completed' : 'Pending',
      completed_at: complete ? new Date().toISOString() : null,
    })
    .eq('id', taskId)
    .eq('assigned_to', user.id)
    .select('id, status, completed_at')
    .single();
  if (error) throw error;
  return data;
}

export async function createMaintenanceComplaint(input) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Sign in first');

  const { data, error } = await supabase
    .from('maintenance_complaints')
    .insert({
      ...input,
      posted_by: user.id,
      status: 'Open',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// payload preserves source sheet columns while report definitions are mapped and verified.
export async function addProductionReport(report) {
  const { data, error } = await supabase
    .from('production_reports')
    .insert({
      module: report.module,
      report_date: report.report_date,
      shift: report.shift ?? null,
      machine_name: report.machine_name ?? null,
      source_sheet: report.source_sheet ?? null,
      source_row_key: report.source_row_key ?? null,
      payload: report.payload,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Do not put a Supabase secret/service_role key in frontend code, GitHub, or browser storage.
// The publishable key is safe only when RLS is enabled and policies are correctly tested.
