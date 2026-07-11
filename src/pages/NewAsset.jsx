import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react'; 
import { supabase } from "../utils/supabase";

const CONDITION_OPTIONS = ['Good', 'Fair', 'Poor'];
const COMMON_CATEGORIES = [
  'Projector',
  'HVAC',
  'Furniture',
  'Electrical',
  'Plumbing', 
  'IT Equipment',
  'Lab Equipment',
  'Vehicle',
];

const EMPTY_FORM = {
  name: '',
  asset_code: '', // optional — leave blank to let the DB trigger auto-generate AST-0001, etc.
  category: '',
  location: '',
  condition: 'Good',
  assigned_technician_id: '',
  last_service_date: '',
  next_service_date: '',
};

function publicAssetUrl(assetCode) {
  return `${window.location.origin}/asset/${assetCode}`;
}

export default function NewAsset() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [technicians, setTechnicians] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [createdAsset, setCreatedAsset] = useState(null); // holds the row after a successful insert

  useEffect(() => {
    loadTechnicians();
  }, []);

  async function loadTechnicians() {
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'technician')
      .order('full_name');

    if (!fetchError) setTechnicians(data ?? []);
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate() {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Asset name is required.';
    if (
      form.last_service_date &&
      form.next_service_date &&
      form.next_service_date < form.last_service_date
    ) {
      errors.next_service_date = 'Next service date cannot be before the last service date.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      location: form.location.trim() || null,
      condition: form.condition,
      assigned_technician_id: form.assigned_technician_id || null,
      last_service_date: form.last_service_date || null,
      next_service_date: form.next_service_date || null,
    };
    // Only send asset_code if the user typed one; otherwise the DB trigger generates it.
    if (form.asset_code.trim()) payload.asset_code = form.asset_code.trim();

    const { data, error: insertError } = await supabase
      .from('assets')
      .insert(payload)
      .select()
      .single();

    setSubmitting(false);

    if (insertError) {
      // Postgres unique_violation
      if (insertError.code === '23505') {
        setFieldErrors((prev) => ({
          ...prev,
          asset_code: 'That asset code is already in use. Try a different one or leave it blank.',
        }));
      } else {
        setError(insertError.message);
      }
      return;
    }

    setCreatedAsset(data);
  }

  function handleRegisterAnother() {
    setCreatedAsset(null);
    setForm(EMPTY_FORM);
  }

  // ---- success state: show the generated code + QR ----
  if (createdAsset) {
    const url = publicAssetUrl(createdAsset.asset_code);
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-8">
        <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            ✓
          </span>
          <h1 className="text-lg font-semibold text-slate-900">Asset registered</h1>
          <p className="mt-1 text-sm text-slate-500">
            {createdAsset.name} · {createdAsset.asset_code}
          </p>

          <div className="mt-5 flex justify-center rounded-lg border border-slate-100 bg-slate-50 p-6">
            <QRCodeCanvas value={url} size={180} includeMargin />
          </div>
          <p className="mt-3 truncate text-xs text-slate-400">{url}</p>

          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              onClick={handleRegisterAnother}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Register Another
            </button>
            <Link
              to="/assets"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View All Assets
            </Link>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Open Public Page
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ---- form state ----
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <Link to="/assets" className="text-xs font-medium text-slate-400 hover:text-slate-700">
            &larr; Back to Assets
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Register Asset
          </h1>
          <p className="text-sm text-slate-500">
            A unique code and QR link are generated automatically when you save.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Asset Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Classroom Projector 01"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
              <input
                list="category-options"
                type="text"
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                placeholder="e.g. Projector"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <datalist id="category-options">
                {COMMON_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => updateField('location', e.target.value)}
                placeholder="e.g. Room 204, Block B"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Condition</label>
              <select
                value={form.condition}
                onChange={(e) => updateField('condition', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {CONDITION_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Assign Technician
              </label>
              <select
                value={form.assigned_technician_id}
                onChange={(e) => updateField('assigned_technician_id', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Last Service Date
              </label>
              <input
                type="date"
                value={form.last_service_date}
                onChange={(e) => updateField('last_service_date', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Next Service Date
              </label>
              <input
                type="date"
                value={form.next_service_date}
                onChange={(e) => updateField('next_service_date', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              {fieldErrors.next_service_date && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.next_service_date}</p>
              )}
            </div>
          </div>

          <details className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-500">
              Advanced: set a custom asset code
            </summary>
            <div className="mt-3">
              <input
                type="text"
                value={form.asset_code}
                onChange={(e) => updateField('asset_code', e.target.value)}
                placeholder="Leave blank to auto-generate (e.g. AST-0001)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              {fieldErrors.asset_code && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.asset_code}</p>
              )}
            </div>
          </details>

          <div className="flex justify-end gap-3 pt-2">
            <Link
              to="/assets"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Register Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
