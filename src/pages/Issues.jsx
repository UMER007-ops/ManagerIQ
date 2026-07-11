import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../utils/supabase";

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];
const STATUS_OPTIONS = [
  'Reported',
  'Assigned',
  'Inspection Started',
  'Maintenance In Progress',
  'Waiting for Parts',
  'Resolved',
  'Closed',
  'Reopened',
];

const STATUS_STYLES = {
  Reported: 'bg-amber-100 text-amber-700 border-amber-200',
  Assigned: 'bg-sky-100 text-sky-700 border-sky-200',
  'Inspection Started': 'bg-sky-100 text-sky-700 border-sky-200',
  'Maintenance In Progress': 'bg-orange-100 text-orange-700 border-orange-200',
  'Waiting for Parts': 'bg-purple-100 text-purple-700 border-purple-200',
  Resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Closed: 'bg-slate-200 text-slate-500 border-slate-300',
  Reopened: 'bg-red-100 text-red-700 border-red-200',
};

const PRIORITY_DOT = {
  Low: 'bg-slate-400',
  Medium: 'bg-sky-500',
  High: 'bg-amber-500',
  Critical: 'bg-red-600',
};

// Business rule: only these forward moves are allowed from the quick list.
// Resolving an issue happens on the Issue Details page, where a maintenance
// note is required first ("an issue should not be resolved without a note").
const ALLOWED_NEXT_STATUS = {
  Reported: ['Assigned'],
  Assigned: ['Inspection Started'],
  'Inspection Started': ['Maintenance In Progress', 'Waiting for Parts'],
  'Maintenance In Progress': ['Waiting for Parts'],
  'Waiting for Parts': ['Maintenance In Progress'],
  Resolved: ['Reopened'], // Closed happens via a supervisor action on the details page
  Closed: ['Reopened'],
  Reopened: ['Assigned', 'Inspection Started', 'Maintenance In Progress'],
};

export default function Issues() {
  const [issues, setIssues] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [technicianFilter, setTechnicianFilter] = useState('All');

  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    loadIssues();
    loadTechnicians();
  }, []);

  async function loadIssues() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('issues')
      .select('*, assets(id, name, asset_code), technician:profiles(id, full_name)')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setIssues(data ?? []);
    }
    setLoading(false);
  }

  async function loadTechnicians() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'technician')
      .order('full_name');
    setTechnicians(data ?? []);
  }

  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((issue) => {
      const matchesSearch =
        !q ||
        issue.title?.toLowerCase().includes(q) ||
        issue.issue_number?.toLowerCase().includes(q) ||
        issue.assets?.name?.toLowerCase().includes(q) ||
        issue.assets?.asset_code?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || issue.status === statusFilter;
      const matchesPriority = priorityFilter === 'All' || issue.priority === priorityFilter;
      const matchesTechnician =
        technicianFilter === 'All' ||
        (technicianFilter === 'Unassigned'
          ? !issue.assigned_technician_id
          : issue.assigned_technician_id === technicianFilter);
      return matchesSearch && matchesStatus && matchesPriority && matchesTechnician;
    });
  }, [issues, search, statusFilter, priorityFilter, technicianFilter]);

  async function handleAssign(issue, technicianId) {
    setSavingId(issue.id);
    const updates = { assigned_technician_id: technicianId || null };
    // Assigning a technician to a freshly reported issue moves it forward.
    if (issue.status === 'Reported' && technicianId) updates.status = 'Assigned';

    const { error: updateError } = await supabase
      .from('issues')
      .update(updates)
      .eq('id', issue.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      await loadIssues();
    }
    setSavingId(null);
  }

  async function handleStatusChange(issue, newStatus) {
    if (!ALLOWED_NEXT_STATUS[issue.status]?.includes(newStatus)) return;

    setSavingId(issue.id);
    const updates = { status: newStatus };
    if (newStatus === 'Resolved') updates.resolved_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('issues')
      .update(updates)
      .eq('id', issue.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      await loadIssues();
    }
    setSavingId(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Issues</h1>
          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${filteredIssues.length} of ${issues.length} issues`}
          </p>
        </div>
        <Link
          to="/report"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          View Public Report Form
        </Link>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ---- filters ---- */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, issue #, or asset…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 sm:max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="All">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="All">All priorities</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={technicianFilter}
          onChange={(e) => setTechnicianFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          <option value="All">All technicians</option>
          <option value="Unassigned">Unassigned</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
      </div>

      {/* ---- table ---- */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Issue</th>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Technician</th>
              <th className="px-4 py-3">Reported</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  Loading issues…
                </td>
              </tr>
            ) : filteredIssues.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No issues match your filters.
                </td>
              </tr>
            ) : (
              filteredIssues.map((issue) => {
                const nextOptions = ALLOWED_NEXT_STATUS[issue.status] ?? [];
                const isSaving = savingId === issue.id;
                return (
                  <tr
                    key={issue.id}
                    className={issue.priority === 'Critical' ? 'bg-red-50/60' : 'hover:bg-slate-50'}
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/issues/${issue.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {issue.title}
                      </Link>
                      <p className="text-xs text-slate-400">{issue.issue_number}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {issue.assets?.name}
                      <p className="text-xs text-slate-400">{issue.assets?.asset_code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                        <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[issue.priority]}`} />
                        {issue.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-block w-fit rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[issue.status] ?? ''}`}
                        >
                          {issue.status}
                        </span>
                        {nextOptions.length > 0 && (
                          <select
                            disabled={isSaving}
                            value=""
                            onChange={(e) => handleStatusChange(issue, e.target.value)}
                            className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          >
                            <option value="" disabled>
                              Move to…
                            </option>
                            {nextOptions.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        disabled={isSaving || issue.status === 'Closed'}
                        value={issue.assigned_technician_id ?? ''}
                        onChange={(e) => handleAssign(issue, e.target.value)}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="">Unassigned</option>
                        {technicians.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(issue.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/issues/${issue.id}`}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
