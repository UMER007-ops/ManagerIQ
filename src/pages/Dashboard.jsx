import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../utils/supabase"; 

// ---- status -> color mapping, shared visual language for the whole app ----
const STATUS_STYLES = {
  Operational: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Issue Reported': 'bg-amber-100 text-amber-700 border-amber-200',
  'Under Inspection': 'bg-sky-100 text-sky-700 border-sky-200',
  'Under Maintenance': 'bg-orange-100 text-orange-700 border-orange-200',
  'Out of Service': 'bg-red-100 text-red-700 border-red-200',
  Retired: 'bg-slate-200 text-slate-500 border-slate-300',
};

const PRIORITY_DOT = {
  Low: 'bg-slate-400',
  Medium: 'bg-sky-500',
  High: 'bg-amber-500',
  Critical: 'bg-red-600',
};

function StatCard({ label, value, hint, accent }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function QuickLink({ to, title, description }) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-900 hover:shadow-md"
    >
      <span className="text-sm font-semibold text-slate-900">{title}</span>
      <span className="text-xs text-slate-500">{description}</span>
      <span className="mt-2 text-xs font-medium text-slate-400 group-hover:text-slate-900">
        Open &rarr;
      </span>
    </Link>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalAssets: 0,
    openIssues: 0,
    criticalIssues: 0,
    resolvedThisMonth: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [criticalIssuesList, setCriticalIssuesList] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const OPEN_STATUSES = [
        'Reported',
        'Assigned',
        'Inspection Started',
        'Maintenance In Progress',
        'Waiting for Parts',
        'Reopened',
      ];

      try {
        const [
          totalAssetsRes,
          openIssuesRes,
          criticalIssuesRes,
          resolvedThisMonthRes,
          activityRes,
          criticalListRes,
        ] = await Promise.all([
          supabase.from('assets').select('id', { count: 'exact', head: true }),
          supabase
            .from('issues')
            .select('id', { count: 'exact', head: true })
            .in('status', OPEN_STATUSES),
          supabase
            .from('issues')
            .select('id', { count: 'exact', head: true })
            .eq('priority', 'Critical')
            .in('status', OPEN_STATUSES),
          supabase
            .from('issues')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Resolved')
            .gte('resolved_at', startOfMonth.toISOString()),
          supabase
            .from('asset_history')
            .select('id, action, created_at, assets(name, asset_code)')
            .order('created_at', { ascending: false })
            .limit(8),
          supabase
            .from('issues')
            .select('id, issue_number, title, priority, status, assets(name, asset_code)')
            .eq('priority', 'Critical')
            .in('status', OPEN_STATUSES)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        const firstError = [
          totalAssetsRes,
          openIssuesRes,
          criticalIssuesRes,
          resolvedThisMonthRes,
          activityRes,
          criticalListRes,
        ].find((r) => r.error)?.error;

        if (firstError) throw firstError;
        if (!isMounted) return;

        setStats({
          totalAssets: totalAssetsRes.count ?? 0,
          openIssues: openIssuesRes.count ?? 0,
          criticalIssues: criticalIssuesRes.count ?? 0,
          resolvedThisMonth: resolvedThisMonthRes.count ?? 0,
        });
        setRecentActivity(activityRes.data ?? []);
        setCriticalIssuesList(criticalListRes.data ?? []);
      } catch (err) {
        if (isMounted) setError(err.message ?? 'Failed to load dashboard data.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <header className="mb-8 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Maintenance Overview
        </h1>
        <p className="text-sm text-slate-500">
          A live snapshot of every asset, open issue, and recent action.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn't load the dashboard: {error}
        </div>
      )}

      {/* ---- stat cards ---- */}
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Assets"
          value={loading ? '—' : stats.totalAssets}
          hint="Registered in the system"
          accent="bg-slate-900"
        />
        <StatCard
          label="Open Issues"
          value={loading ? '—' : stats.openIssues}
          hint="Not yet resolved"
          accent="bg-amber-500"
        />
        <StatCard
          label="Critical Issues"
          value={loading ? '—' : stats.criticalIssues}
          hint="Need immediate attention"
          accent="bg-red-600"
        />
        <StatCard
          label="Resolved This Month"
          value={loading ? '—' : stats.resolvedThisMonth}
          hint="Since the 1st"
          accent="bg-emerald-500"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ---- recent activity ---- */}
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Recent Activity</h2>
          {loading ? (
            <p className="text-sm text-slate-400">Loading activity…</p>
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-slate-400">
              Nothing to show yet. Actions on assets and issues will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentActivity.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-slate-800">{entry.action}</p>
                    <p className="text-xs text-slate-400">
                      {entry.assets?.name} · {entry.assets?.asset_code}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---- critical issues watchlist ---- */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Critical Watchlist</h2>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : criticalIssuesList.length === 0 ? (
            <p className="text-sm text-slate-400">No open critical issues right now.</p>
          ) : (
            <ul className="space-y-3">
              {criticalIssuesList.map((issue) => (
                <li key={issue.id}>
                  <Link
                    to={`/issues/${issue.id}`}
                    className="flex items-start gap-2 rounded-lg border border-transparent p-2 -m-2 hover:border-slate-200 hover:bg-slate-50"
                  >
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[issue.priority]}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{issue.title}</p>
                      <p className="text-xs text-slate-400">
                        {issue.issue_number} · {issue.assets?.name}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] ${STATUS_STYLES[issue.status] ?? ''}`}
                      >
                        {issue.status}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---- quick links ---- */}
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink to="/assets" title="Assets" description="Register, search, and manage assets" />
        <QuickLink to="/issues" title="Issues" description="Review, assign, and track status" />
        <QuickLink to="/report" title="Report an Issue" description="Open the public reporting form" />
        <QuickLink to="/assets/new" title="Register Asset" description="Add a new asset + QR code" />
      </section>
    </div>
  );
}
