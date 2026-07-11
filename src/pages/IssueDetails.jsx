import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from "../utils/supabase";

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

// Same guarded workflow as the Issues list, plus "Resolved" — which is only
// reachable from here, and only once a maintenance note exists.
const ALLOWED_NEXT_STATUS = {
  Reported: ['Assigned'],
  Assigned: ['Inspection Started'],
  'Inspection Started': ['Maintenance In Progress', 'Waiting for Parts'],
  'Maintenance In Progress': ['Waiting for Parts', 'Resolved'],
  'Waiting for Parts': ['Maintenance In Progress'],
  Resolved: ['Closed', 'Reopened'],
  Closed: ['Reopened'],
  Reopened: ['Assigned', 'Inspection Started', 'Maintenance In Progress'],
};

const EMPTY_NOTE_FORM = {
  inspection_notes: '',
  work_performed: '',
  parts_used: '',
  cost: '',
  time_spent_minutes: '',
  final_condition: 'Good',
};

export default function IssueDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [issue, setIssue] = useState(null);
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [technicians, setTechnicians] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const [noteForm, setNoteForm] = useState(EMPTY_NOTE_FORM);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState(null);

  useEffect(() => {
    loadAll();
    loadTechnicians();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadAll() {
    setLoading(true);
    setError(null);

    const [issueRes, maintenanceRes, historyRes] = await Promise.all([
      supabase
        .from('issues')
        .select('*, assets(*), technician:profiles(id, full_name)')
        .eq('id', id)
        .single(),
      supabase
        .from('maintenance_records')
        .select('*, technician:profiles(full_name)')
        .eq('issue_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('asset_history')
        .select('*')
        .eq('issue_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (issueRes.error) {
      setError(issueRes.error.message);
    } else {
      setIssue(issueRes.data);
    }
    setMaintenanceRecords(maintenanceRes.data ?? []);
    setHistory(historyRes.data ?? []);
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

  async function handleAssign(technicianId) {
    setStatusSaving(true);
    const updates = { assigned_technician_id: technicianId || null };
    if (issue.status === 'Reported' && technicianId) updates.status = 'Assigned';

    const { error: updateError } = await supabase.from('issues').update(updates).eq('id', id);
    if (updateError) setError(updateError.message);
    else await loadAll();
    setStatusSaving(false);
  }

  async function handleStatusChange(newStatus) {
    if (!ALLOWED_NEXT_STATUS[issue.status]?.includes(newStatus)) return;

    // Business rule: an issue should not be resolved without a maintenance note.
    if (newStatus === 'Resolved' && maintenanceRecords.length === 0) {
      setError('Add a maintenance note below before marking this issue Resolved.');
      return;
    }

    setStatusSaving(true);
    setError(null);
    const updates = { status: newStatus };
    if (newStatus === 'Resolved') updates.resolved_at = new Date().toISOString();

    const { error: updateError } = await supabase.from('issues').update(updates).eq('id', id);
    if (updateError) setError(updateError.message);
    else await loadAll();
    setStatusSaving(false);
  }

  function updateNoteField(key, value) {
    setNoteForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAddNote(e) {
    e.preventDefault();
    setNoteError(null);

    if (!noteForm.work_performed.trim()) {
      setNoteError('Describe the work performed before saving.');
      return;
    }
    const cost = noteForm.cost === '' ? 0 : Number(noteForm.cost);
    if (Number.isNaN(cost) || cost < 0) {
      setNoteError('Cost must be zero or a positive number.');
      return;
    }

    setSavingNote(true);

    // Upload any attached evidence to the 'evidence' storage bucket first.
    const evidenceUrls = [];
    for (const file of evidenceFiles) {
      const path = `${id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('evidence').upload(path, file);
      if (uploadError) {
        setNoteError(`Upload failed for ${file.name}: ${uploadError.message}`);
        setSavingNote(false);
        return;
      }
      const { data: publicUrlData } = supabase.storage.from('evidence').getPublicUrl(path);
      evidenceUrls.push(publicUrlData.publicUrl);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from('maintenance_records').insert({
      issue_id: id,
      technician_id: user?.id ?? null,
      inspection_notes: noteForm.inspection_notes.trim() || null,
      work_performed: noteForm.work_performed.trim(),
      parts_used: noteForm.parts_used.trim() || null,
      cost,
      time_spent_minutes: noteForm.time_spent_minutes ? Number(noteForm.time_spent_minutes) : null,
      final_condition: noteForm.final_condition,
      evidence_urls: evidenceUrls,
    });

    setSavingNote(false);

    if (insertError) {
      setNoteError(insertError.message);
      return;
    }

    setNoteForm(EMPTY_NOTE_FORM);
    setEvidenceFiles([]);
    await loadAll();
  }

  if (loading) {
    return <div className="p-8 text-sm text-slate-400">Loading issue…</div>;
  }

  if (error && !issue) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!issue) {
    return <div className="p-8 text-sm text-slate-400">Issue not found.</div>;
  }

  const nextOptions = ALLOWED_NEXT_STATUS[issue.status] ?? [];
  const isClosed = issue.status === 'Closed';

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <Link to="/issues" className="text-xs font-medium text-slate-400 hover:text-slate-700">
          &larr; Back to Issues
        </Link>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ---- header ---- */}
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-400">{issue.issue_number}</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                {issue.title}
              </h1>
              <Link
                to={`/assets/${issue.assets?.id}`}
                className="mt-1 inline-block text-sm text-slate-500 hover:underline"
              >
                {issue.assets?.name} · {issue.assets?.asset_code}
              </Link>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLES[issue.status] ?? ''}`}
              >
                {issue.status}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[issue.priority]}`} />
                {issue.priority} priority
              </span>
            </div>
          </div>

          <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{issue.description}</p>

          {issue.evidence_urls?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {issue.evidence_urls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt="Reported evidence" className="h-20 w-20 rounded-lg object-cover" />
                </a>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">Category</p>
              <p className="text-slate-700">{issue.category ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Reported By</p>
              <p className="text-slate-700">{issue.reporter_name ?? 'Anonymous'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Reported On</p>
              <p className="text-slate-700">{new Date(issue.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Resolved On</p>
              <p className="text-slate-700">
                {issue.resolved_at ? new Date(issue.resolved_at).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>

          {/* ---- assignment + status controls ---- */}
          <div className="mt-6 flex flex-wrap items-end gap-4 border-t border-slate-100 pt-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Technician</label>
              <select
                disabled={statusSaving || isClosed}
                value={issue.assigned_technician_id ?? ''}
                onChange={(e) => handleAssign(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>

            {nextOptions.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Move status to
                </label>
                <select
                  disabled={statusSaving}
                  value=""
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {nextOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ---- maintenance notes ---- */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Maintenance Notes</h2>

          {maintenanceRecords.length === 0 ? (
            <p className="mb-5 text-sm text-slate-400">No maintenance notes yet.</p>
          ) : (
            <ul className="mb-6 space-y-4">
              {maintenanceRecords.map((rec) => (
                <li key={rec.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span>{rec.technician?.full_name ?? 'Unknown technician'}</span>
                    <span>{new Date(rec.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-800">{rec.work_performed}</p>
                  {rec.inspection_notes && (
                    <p className="mt-1 text-sm text-slate-600">
                      <span className="font-medium">Inspection:</span> {rec.inspection_notes}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                    {rec.parts_used && <span>Parts: {rec.parts_used}</span>}
                    <span>Cost: {Number(rec.cost).toFixed(2)}</span>
                    {rec.time_spent_minutes && <span>Time: {rec.time_spent_minutes} min</span>}
                    {rec.final_condition && <span>Condition after: {rec.final_condition}</span>}
                  </div>
                  {rec.evidence_urls?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rec.evidence_urls.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt="Maintenance evidence" className="h-16 w-16 rounded-lg object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isClosed ? (
            <p className="text-sm text-slate-400">
              This issue is closed. Reopen it above to add further notes.
            </p>
          ) : (
            <form onSubmit={handleAddNote} className="space-y-4 border-t border-slate-100 pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Add a Note
              </h3>

              {noteError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {noteError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Work Performed <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={noteForm.work_performed}
                  onChange={(e) => updateNoteField('work_performed', e.target.value)}
                  rows={2}
                  placeholder="e.g. Replaced damaged HDMI cable and tested output"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Inspection Notes
                </label>
                <textarea
                  value={noteForm.inspection_notes}
                  onChange={(e) => updateNoteField('inspection_notes', e.target.value)}
                  rows={2}
                  placeholder="What did you find during inspection?"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Parts Used</label>
                  <input
                    type="text"
                    value={noteForm.parts_used}
                    onChange={(e) => updateNoteField('parts_used', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={noteForm.cost}
                    onChange={(e) => updateNoteField('cost', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Time (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={noteForm.time_spent_minutes}
                    onChange={(e) => updateNoteField('time_spent_minutes', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Condition After
                  </label>
                  <select
                    value={noteForm.final_condition}
                    onChange={(e) => updateNoteField('final_condition', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option>Good</option>
                    <option>Fair</option>
                    <option>Poor</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Evidence (photos)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setEvidenceFiles(Array.from(e.target.files ?? []))}
                  className="w-full text-sm text-slate-600"
                />
              </div>

              <button
                type="submit"
                disabled={savingNote}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {savingNote ? 'Saving…' : 'Save Note'}
              </button>
            </form>
          )}
        </div>

        {/* ---- history ---- */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Activity History</h2>
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="text-slate-700">{entry.action}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
