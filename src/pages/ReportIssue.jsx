import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from "../utils/supabase";

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];
const CATEGORY_OPTIONS = [
  'Electrical',
  'Mechanical',
  'Plumbing',
  'HVAC / Cooling',
  'IT / Electronics',
  'Structural',
  'Other',
];

const EMPTY_FORM = {
  title: '',
  description: '',
  category: '',
  priority: 'Medium',
  reporter_name: '',
  reporter_contact: '',
};

export default function ReportIssue() {
  const [searchParams] = useSearchParams();
  const assetCodeFromLink = searchParams.get('asset'); // e.g. /report?asset=AST-0001

  const [codeInput, setCodeInput] = useState(assetCodeFromLink ?? '');
  const [asset, setAsset] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submittedIssue, setSubmittedIssue] = useState(null);

  useEffect(() => {
    if (assetCodeFromLink) lookupAsset(assetCodeFromLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetCodeFromLink]);

  async function lookupAsset(code) {
    setLookupLoading(true);
    setLookupError(null);
    setAsset(null);

    // Public-safe view — never exposes internal notes, cost, or user data.
    const { data, error } = await supabase
      .from('asset_public_view')
      .select('*')
      .eq('asset_code', code.trim())
      .single();

    setLookupLoading(false);

    if (error || !data) {
      setLookupError('No asset found for that code. Double-check it and try again.');
      return;
    }
    setAsset(data);
  }

  function handleLookupSubmit(e) {
    e.preventDefault();
    if (!codeInput.trim()) return;
    lookupAsset(codeInput);
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate() {
    const errors = {};
    if (!form.title.trim()) errors.title = 'Give the issue a short title.';
    if (!form.description.trim()) errors.description = 'Describe the problem.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);

    // Upload evidence first (public bucket, no login required).
    const evidenceUrls = [];
    for (const file of evidenceFiles) {
      const path = `reports/${asset.asset_code}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('evidence').upload(path, file);
      if (uploadError) {
        setFormError(`Upload failed for ${file.name}: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }
      const { data: publicUrlData } = supabase.storage.from('evidence').getPublicUrl(path);
      evidenceUrls.push(publicUrlData.publicUrl);
    }

    const { data, error: insertError } = await supabase
      .from('issues')
      .insert({
        asset_id: asset.id,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category || null,
        priority: form.priority,
        reporter_name: form.reporter_name.trim() || null,
        reporter_contact: form.reporter_contact.trim() || null,
        evidence_urls: evidenceUrls,
      })
      .select()
      .single();

    setSubmitting(false);

    if (insertError) {
      setFormError(insertError.message);
      return;
    }
    setSubmittedIssue(data);
  }

  // ---- success screen ----
  if (submittedIssue) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            ✓
          </span>
          <h1 className="text-lg font-semibold text-slate-900">Issue reported</h1>
          <p className="mt-1 text-sm text-slate-500">
            Reference number <span className="font-medium text-slate-700">{submittedIssue.issue_number}</span>
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Thanks for the report. A technician will review it and take action on{' '}
            <span className="font-medium">{asset.name}</span> ({asset.asset_code}).
          </p>
          <button
            onClick={() => {
              setSubmittedIssue(null);
              setForm(EMPTY_FORM);
              setEvidenceFiles([]);
            }}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Report Another Issue
          </button>
        </div>
      </div>
    );
  }

  // ---- step 1: find the asset ----
  if (!asset) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Report an Issue</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter the asset code printed on the label, or scan its QR code again.
          </p>

          <form onSubmit={handleLookupSubmit} className="mt-5 space-y-3">
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="e.g. AST-0001"
              autoFocus
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {lookupError && <p className="text-xs text-red-600">{lookupError}</p>}
            <button
              type="submit"
              disabled={lookupLoading}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {lookupLoading ? 'Looking up…' : 'Find Asset'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ---- retired assets can't take new reports ----
  if (asset.status === 'Retired') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">{asset.name}</h1>
          <p className="mt-1 text-xs text-slate-400">{asset.asset_code}</p>
          <span className="mt-3 inline-block rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
            Retired
          </span>
          <p className="mt-4 text-sm text-slate-500">
            This asset has been retired and is no longer in service, so new issues can't be
            reported against it.
          </p>
        </div>
      </div>
    );
  }

  // ---- step 2: report the issue ----
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-400">Reporting an issue for</p>
          <h1 className="text-lg font-semibold text-slate-900">{asset.name}</h1>
          <p className="text-xs text-slate-400">
            {asset.asset_code} · {asset.location ?? 'Location not set'}
          </p>
          <button
            onClick={() => setAsset(null)}
            className="mt-2 text-xs font-medium text-slate-400 hover:text-slate-700"
          >
            Not the right asset?
          </button>
        </div>

        {formError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="e.g. Display flickering, HDMI not detected"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {fieldErrors.title && <p className="mt-1 text-xs text-red-600">{fieldErrors.title}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Describe the problem <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={4}
              placeholder="What's happening? When did it start?"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {fieldErrors.description && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
              <select
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">Select…</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => updateField('priority', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {form.priority === 'Critical' && (
                <p className="mt-1 text-xs text-red-600">
                  For an immediate safety hazard, also notify staff in person.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Your Name</label>
              <input
                type="text"
                value={form.reporter_name}
                onChange={(e) => updateField('reporter_name', e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Contact</label>
              <input
                type="text"
                value={form.reporter_contact}
                onChange={(e) => updateField('reporter_contact', e.target.value)}
                placeholder="Phone or email, optional"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Photo Evidence
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
            disabled={submitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Staff can review this from the{' '}
          <Link to="/issues" className="underline hover:text-slate-700">
            Issues dashboard
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
