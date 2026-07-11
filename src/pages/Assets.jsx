import { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { supabase } from "../utils/supabase";
import { useCurrentProfile } from '../useCurrentProfile';

const STATUS_OPTIONS = [
  'Operational',
  'Issue Reported',
  'Under Inspection',
  'Under Maintenance',
  'Out of Service',
  'Retired',
];

const STATUS_STYLES = {
  Operational: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Issue Reported': 'bg-amber-100 text-amber-700 border-amber-200',
  'Under Inspection': 'bg-sky-100 text-sky-700 border-sky-200',
  'Under Maintenance': 'bg-orange-100 text-orange-700 border-orange-200',
  'Out of Service': 'bg-red-100 text-red-700 border-red-200',
  Retired: 'bg-slate-200 text-slate-500 border-slate-300',
};

// Where the public, no-login asset page will live once we build it.
// Encoded into the QR code and used for "copy link".
function publicAssetUrl(assetCode) {
  return `${window.location.origin}/asset/${assetCode}`;
}

function QrModal({ asset, onClose }) {
  const canvasWrapRef = useRef(null);
  const [copied, setCopied] = useState(false);

  if (!asset) return null;

  const url = publicAssetUrl(asset.asset_code);

  function handleCopyLink() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleDownload() {
    const canvas = canvasWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${asset.asset_code}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{asset.name}</h3>
            <p className="text-xs text-slate-400">{asset.asset_code}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div ref={canvasWrapRef} className="flex justify-center rounded-lg border border-slate-100 bg-slate-50 p-6">
          <QRCodeCanvas value={url} size={180} includeMargin />
        </div>

        <p className="mt-3 truncate text-center text-xs text-slate-400">{url}</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={handleDownload}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"
          >
            Download PNG
          </button>
          <button
            onClick={handleCopyLink}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Public Asset Page
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Assets() {
  const { isAdmin } = useCurrentProfile();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const [qrAsset, setQrAsset] = useState(null);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    loadAssets();
  }, []);

  async function loadAssets() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setAssets(data ?? []);
    }
    setLoading(false);
  }

  const categories = useMemo(() => {
    const set = new Set(assets.map((a) => a.category).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      const matchesSearch =
        !q ||
        a.name?.toLowerCase().includes(q) ||
        a.asset_code?.toLowerCase().includes(q) ||
        a.location?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || a.status === statusFilter;
      const matchesCategory = categoryFilter === 'All' || a.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [assets, search, statusFilter, categoryFilter]);

  async function handleStatusChange(asset, newStatus) {
    setSavingId(asset.id);
    const { error: updateError } = await supabase
      .from('assets')
      .update({ status: newStatus })
      .eq('id', asset.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setAssets((prev) =>
        prev.map((a) => (a.id === asset.id ? { ...a, status: newStatus } : a))
      );
    }
    setSavingId(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Assets</h1>
          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${filteredAssets.length} of ${assets.length} assets`}
          </p>
        </div>
        {isAdmin && (
          <Link
            to="/assets/new"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            + Register Asset
          </Link>
        )}
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ---- filters ---- */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code, or location…"
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
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'All' ? 'All categories' : c}
            </option>
          ))}
        </select>
      </div>

      {/* ---- table ---- */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Next Service</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Loading assets…
                </td>
              </tr>
            ) : filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No assets match your filters.
                </td>
              </tr>
            ) : (
              filteredAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/assets/${asset.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {asset.name}
                    </Link>
                    <p className="text-xs text-slate-400">{asset.category ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{asset.asset_code}</td>
                  <td className="px-4 py-3 text-slate-600">{asset.location ?? '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={asset.status}
                      disabled={savingId === asset.id}
                      onChange={(e) => handleStatusChange(asset, e.target.value)}
                      className={`rounded-full border px-2 py-1 text-xs font-medium ${STATUS_STYLES[asset.status] ?? ''}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {asset.next_service_date
                      ? new Date(asset.next_service_date).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setQrAsset(asset)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        QR
                      </button>
                      <Link
                        to={`/assets/${asset.id}/edit`}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <QrModal asset={qrAsset} onClose={() => setQrAsset(null)} />
    </div>
  );
}
