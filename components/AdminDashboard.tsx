import React, { useMemo, useState } from 'react';
import { useEscapeClose } from '../lib/use-escape-close';
import { Search, Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, FileDown, History, StickyNote } from 'lucide-react';
import { PricingMatrix } from './PricingMatrix';

export type PaymentStatus = 'paid' | 'missed' | 'overdue';

export interface PaymentRecord {
  date: string;
  amount: number;
  status: PaymentStatus;
  note?: string;
}

export interface AdminClient {
  id: string;
  name: string;
  email: string;
  package: 'Starter' | 'Pro' | 'Enterprise' | 'Diamond';
  monthlyFee: number;
  setupFeePaid: boolean;
  addOns: string[];
  totalMRR: number;
  paymentStatus: PaymentStatus;
  lastPaymentDate: string;
  renewalDate: string;
  annualPlan: boolean;
  unsubscribeDate: string | null;
  active: boolean;
  notes: string;
  paymentHistory: PaymentRecord[];
}

const PACKAGES: AdminClient['package'][] = ['Starter', 'Pro', 'Enterprise', 'Diamond'];
const PAYMENT_STATUSES: PaymentStatus[] = ['paid', 'missed', 'overdue'];

const MOCK_CLIENTS: AdminClient[] = [
  { id: '1', name: 'Royal Diamonds Ltd', email: 'contact@royaldiamonds.com', package: 'Pro', monthlyFee: 997, setupFeePaid: true, addOns: ['Extra showroom location'], totalMRR: 1396, paymentStatus: 'paid', lastPaymentDate: '2025-02-01', renewalDate: '2025-03-01', annualPlan: false, unsubscribeDate: null, active: true, notes: 'VIP account.', paymentHistory: [{ date: '2025-02-01', amount: 1396, status: 'paid' }, { date: '2025-01-01', amount: 1396, status: 'paid' }] },
  { id: '2', name: 'Rossi Haute Joaillerie', email: 'julianna@rossi-jewelry.com', package: 'Enterprise', monthlyFee: 1997, setupFeePaid: true, addOns: ['White-glove onboarding sprint'], totalMRR: 1997, paymentStatus: 'paid', lastPaymentDate: '2025-02-15', renewalDate: '2026-02-15', annualPlan: true, unsubscribeDate: null, active: true, notes: '', paymentHistory: [{ date: '2025-02-15', amount: 19164, status: 'paid', note: 'Annual upfront' }] },
  { id: '3', name: 'Boutique Éclat', email: 'hello@eclat.fr', package: 'Starter', monthlyFee: 497, setupFeePaid: true, addOns: [], totalMRR: 497, paymentStatus: 'overdue', lastPaymentDate: '2025-01-10', renewalDate: '2025-02-10', annualPlan: false, unsubscribeDate: null, active: true, notes: 'Follow up on overdue.', paymentHistory: [{ date: '2025-01-10', amount: 497, status: 'paid' }, { date: '2024-12-10', amount: 497, status: 'paid' }] },
  { id: '4', name: 'London Diamonds', email: 'info@londondiamonds.co.uk', package: 'Pro', monthlyFee: 997, setupFeePaid: true, addOns: [], totalMRR: 997, paymentStatus: 'missed', lastPaymentDate: '2024-12-01', renewalDate: '2025-01-01', annualPlan: false, unsubscribeDate: null, active: true, notes: '', paymentHistory: [{ date: '2024-12-01', amount: 997, status: 'paid' }] },
  { id: '5', name: 'Silver Lane Jewelers', email: 'admin@silverlane.com', package: 'Starter', monthlyFee: 497, setupFeePaid: false, addOns: [], totalMRR: 0, paymentStatus: 'overdue', lastPaymentDate: '-', renewalDate: '2025-03-20', annualPlan: false, unsubscribeDate: '2025-02-28', active: false, notes: 'Churned.', paymentHistory: [] },
  { id: '6', name: 'Apex Vault', email: 'ops@apexvault.com', package: 'Diamond', monthlyFee: 3499, setupFeePaid: true, addOns: [], totalMRR: 3499, paymentStatus: 'paid', lastPaymentDate: '2025-02-20', renewalDate: '2025-03-20', annualPlan: false, unsubscribeDate: null, active: true, notes: '', paymentHistory: [{ date: '2025-02-20', amount: 3499, status: 'paid' }] },
];

function escapeCsvCell(s: string | number): string {
  const str = String(s);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function exportToCsv(clients: AdminClient[]) {
  const headers = ['Name', 'Email', 'Package', 'Monthly Fee', 'Setup Fee Paid', 'Add-ons', 'Total MRR', 'Payment Status', 'Last Payment', 'Renewal Date', 'Annual Plan', 'Unsubscribe Date', 'Active', 'Notes'];
  const rows = clients.map((c) => [
    c.name,
    c.email,
    c.package,
    c.monthlyFee,
    c.setupFeePaid ? 'Yes' : 'No',
    c.addOns.join('; '),
    c.totalMRR,
    c.paymentStatus,
    c.lastPaymentDate,
    c.renewalDate,
    c.annualPlan ? 'Yes' : 'No',
    c.unsubscribeDate ?? '',
    c.active ? 'Yes' : 'No',
    c.notes,
  ]);
  const csv = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fourcee-clients-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type SortKey = keyof AdminClient | null;
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 10;

interface AdminDashboardProps {
  isDarkMode?: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isDarkMode = false }) => {
  const [clients, setClients] = useState<AdminClient[]>(MOCK_CLIENTS);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterAnnual, setFilterAnnual] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [historyClientId, setHistoryClientId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  useEscapeClose(!!editingId, () => setEditingId(null), 1600);
  useEscapeClose(adding, () => setAdding(false), 1600);
  useEscapeClose(!!historyClientId, () => setHistoryClientId(null), 1600);
  useEscapeClose(!!deleteConfirmId, () => setDeleteConfirmId(null), 1600);

  const filtered = useMemo(() => {
    let list = clients.filter((c) => {
      const q = search.toLowerCase();
      if (q && !c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q) && !c.package.toLowerCase().includes(q)) return false;
      if (filterActive !== null && c.active !== filterActive) return false;
      if (filterOverdue && c.paymentStatus !== 'overdue') return false;
      if (filterAnnual && !c.annualPlan) return false;
      return true;
    });
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp = typeof av === 'string' && typeof bv === 'string' ? av.localeCompare(bv) : typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [clients, search, filterActive, filterOverdue, filterAnnual, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [filtered, page]);

  const totalMRR = useMemo(() => filtered.reduce((sum, c) => sum + c.totalMRR, 0), [filtered]);
  const churnedCount = clients.filter((c) => !c.active).length;
  const churnRate = clients.length > 0 ? ((churnedCount / clients.length) * 100).toFixed(1) : '0';

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(0);
  };

  const handleSaveEdit = (payload: Partial<AdminClient>) => {
    if (!editingId) return;
    setClients((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...payload } : c)));
    setEditingId(null);
  };

  const handleAdd = (payload: Omit<AdminClient, 'id'>) => {
    const newClient: AdminClient = {
      ...payload,
      id: String(Date.now()),
      paymentHistory: [],
    };
    setClients((prev) => [...prev, newClient]);
    setAdding(false);
  };

  const handleDelete = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    setDeleteConfirmId(null);
    setPage((p) => Math.min(p, Math.max(0, Math.ceil((filtered.length - 1) / PAGE_SIZE) - 1)));
  };

  const Th: React.FC<{ columnKey?: SortKey; children: React.ReactNode; className?: string }> = ({ columnKey, children, className = '' }) => (
    <th className={`text-[10px] font-bold uppercase tracking-widest text-navy-500 dark:text-navy-400 py-4 px-4 ${className}`}>
      {columnKey ? (
        <button type="button" onClick={() => handleSort(columnKey)} className="flex items-center gap-1 hover:text-navy-900 dark:hover:text-white">
          {children}
          {sortKey === columnKey && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
        </button>
      ) : (
        children
      )}
    </th>
  );

  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 max-w-[1800px] mx-auto">
      <p role="status" data-testid="admin-sample-banner" className="mb-4 rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-950">
        Internal preview · sample data only · no login · not for customers (enabled by VITE_ENABLE_ADMIN)
      </p>
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl md:text-4xl font-bold serif text-navy-900 dark:text-white">Admin - Voice AI SaaS</h1>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => exportToCsv(filtered)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-navy-900 dark:bg-white text-white dark:text-navy-950 text-xs font-bold uppercase tracking-widest hover:opacity-90"
            >
              <FileDown className="w-4 h-4" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Add client
            </button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
          <input
            type="text"
            placeholder="Search by name, email, package…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white text-sm focus:ring-2 focus:ring-navy-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-2xl border border-navy-200 dark:border-navy-700 p-5 bg-white dark:bg-navy-900/40">
          <p className="text-[10px] font-bold uppercase tracking-widest text-navy-500 dark:text-navy-400 mb-1">Total MRR (filtered)</p>
          <p className="text-2xl font-bold serif text-navy-900 dark:text-white">${totalMRR.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-navy-200 dark:border-navy-700 p-5 bg-white dark:bg-navy-900/40">
          <p className="text-[10px] font-bold uppercase tracking-widest text-navy-500 dark:text-navy-400 mb-1">Churn rate</p>
          <p className="text-2xl font-bold serif text-navy-900 dark:text-white">{churnRate}%</p>
        </div>
        <div className="rounded-2xl border border-navy-200 dark:border-navy-700 p-5 bg-white dark:bg-navy-900/40">
          <p className="text-[10px] font-bold uppercase tracking-widest text-navy-500 dark:text-navy-400 mb-1">Active clients</p>
          <p className="text-2xl font-bold serif text-navy-900 dark:text-white">{clients.filter((c) => c.active).length}</p>
        </div>
        <div className="rounded-2xl border border-navy-200 dark:border-navy-700 p-5 bg-white dark:bg-navy-900/40">
          <p className="text-[10px] font-bold uppercase tracking-widest text-navy-500 dark:text-navy-400 mb-1">Overdue</p>
          <p className="text-2xl font-bold serif text-red-600 dark:text-red-400">{clients.filter((c) => c.paymentStatus === 'overdue').length}</p>
        </div>
      </div>

      <div className="mb-8">
        <PricingMatrix />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-[10px] font-bold uppercase tracking-widest text-navy-500 dark:text-navy-400 mr-2">Filters:</span>
        <button type="button" onClick={() => { setFilterActive(null); setPage(0); }} className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${filterActive === null ? 'bg-navy-900 dark:bg-white text-white dark:text-navy-950' : 'bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-300 hover:bg-navy-200 dark:hover:bg-navy-700'}`}>All</button>
        <button type="button" onClick={() => { setFilterActive(true); setPage(0); }} className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${filterActive === true ? 'bg-navy-900 dark:bg-white text-white dark:text-navy-950' : 'bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-300 hover:bg-navy-200 dark:hover:bg-navy-700'}`}>Active</button>
        <button type="button" onClick={() => { setFilterOverdue(!filterOverdue); setPage(0); }} className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${filterOverdue ? 'bg-navy-900 dark:bg-white text-white dark:text-navy-950' : 'bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-300 hover:bg-navy-200 dark:hover:bg-navy-700'}`}>Overdue</button>
        <button type="button" onClick={() => { setFilterAnnual(!filterAnnual); setPage(0); }} className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${filterAnnual ? 'bg-navy-900 dark:bg-white text-white dark:text-navy-950' : 'bg-navy-100 dark:bg-navy-800 text-navy-700 dark:text-navy-300 hover:bg-navy-200 dark:hover:bg-navy-700'}`}>Annual</button>
      </div>

      <div className="rounded-2xl border border-navy-200 dark:border-navy-700 overflow-hidden bg-white dark:bg-navy-900/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-navy-200 dark:border-navy-700 bg-navy-50 dark:bg-navy-800/50">
                <Th columnKey="name">Name</Th>
                <Th columnKey="email">Email</Th>
                <Th columnKey="package">Package</Th>
                <Th columnKey="monthlyFee">Monthly fee</Th>
                <Th columnKey="totalMRR">Total MRR</Th>
                <Th columnKey="paymentStatus">Payment</Th>
                <Th columnKey="renewalDate">Renewal</Th>
                <Th columnKey="annualPlan">Annual</Th>
                <th className="text-[10px] font-bold uppercase tracking-widest text-navy-500 dark:text-navy-400 py-4 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => (
                <tr key={c.id} className="border-b border-navy-100 dark:border-navy-800 hover:bg-navy-50/50 dark:hover:bg-navy-800/30">
                  <td className="py-3 px-4 font-medium text-navy-900 dark:text-white">{c.name}</td>
                  <td className="py-3 px-4 text-sm text-navy-700 dark:text-navy-300">{c.email}</td>
                  <td className="py-3 px-4 text-sm text-navy-700 dark:text-navy-300">{c.package}</td>
                  <td className="py-3 px-4 text-sm text-navy-700 dark:text-navy-300">${c.monthlyFee}</td>
                  <td className="py-3 px-4 font-semibold text-navy-900 dark:text-white">${c.totalMRR.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.paymentStatus === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : c.paymentStatus === 'overdue' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'}`}>{c.paymentStatus}</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-navy-700 dark:text-navy-300">{c.renewalDate}</td>
                  <td className="py-3 px-4 text-sm">{c.annualPlan ? <span className="text-emerald-600 dark:text-emerald-400">Yes</span> : 'No'}</td>
                  <td className="py-3 px-4 flex items-center gap-2">
                    <button type="button" onClick={() => setHistoryClientId(c.id)} className="p-1.5 rounded-lg hover:bg-navy-100 dark:hover:bg-navy-800 text-navy-600 dark:text-navy-400" title="Payment history"><History className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setEditingId(c.id)} className="p-1.5 rounded-lg hover:bg-navy-100 dark:hover:bg-navy-800 text-navy-600 dark:text-navy-400" title="Edit"><Pencil className="w-4 h-4" /></button>
                    {deleteConfirmId === c.id ? (
                      <span className="flex items-center gap-1">
                        <button type="button" onClick={() => handleDelete(c.id)} className="text-[10px] font-bold text-red-600 hover:underline">Confirm</button>
                        <button type="button" onClick={() => setDeleteConfirmId(null)} className="text-[10px] font-bold text-navy-600 dark:text-navy-400">Cancel</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setDeleteConfirmId(c.id)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-navy-500 dark:text-navy-400 text-sm">No clients match the current filters.</div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-navy-200 dark:border-navy-700">
            <p className="text-xs text-navy-500 dark:text-navy-400">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg border border-navy-200 dark:border-navy-700 text-sm font-medium disabled:opacity-50">Prev</button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-lg border border-navy-200 dark:border-navy-700 text-sm font-medium disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingId && (() => {
        const c = clients.find((x) => x.id === editingId);
        if (!c) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setEditingId(null)}>
            <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold serif text-navy-900 dark:text-white">Edit client</h2>
                <button type="button" onClick={() => setEditingId(null)} className="p-2 rounded-lg hover:bg-navy-100 dark:hover:bg-navy-800"><X className="w-5 h-5" /></button>
              </div>
              <EditForm client={c} onSave={handleSaveEdit} onCancel={() => setEditingId(null)} />
            </div>
          </div>
        );
      })()}

      {/* Add modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setAdding(false)}>
          <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold serif text-navy-900 dark:text-white">Add client</h2>
              <button type="button" onClick={() => setAdding(false)} className="p-2 rounded-lg hover:bg-navy-100 dark:hover:bg-navy-800"><X className="w-5 h-5" /></button>
            </div>
            <AddForm onAdd={handleAdd} onCancel={() => setAdding(false)} />
          </div>
        </div>
      )}

      {/* Payment history modal */}
      {historyClientId && (() => {
        const c = clients.find((x) => x.id === historyClientId);
        if (!c) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setHistoryClientId(null)}>
            <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold serif text-navy-900 dark:text-white">Payment history - {c.name}</h2>
                <button type="button" onClick={() => setHistoryClientId(null)} className="p-2 rounded-lg hover:bg-navy-100 dark:hover:bg-navy-800"><X className="w-5 h-5" /></button>
              </div>
              {c.paymentHistory.length === 0 ? (
                <p className="text-sm text-navy-500 dark:text-navy-400">No payments recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {c.paymentHistory.map((p, i) => (
                    <li key={i} className="flex justify-between items-center py-2 border-b border-navy-100 dark:border-navy-800 text-sm">
                      <span className="text-navy-700 dark:text-navy-300">{p.date}</span>
                      <span className="font-semibold text-navy-900 dark:text-white">${p.amount.toLocaleString()}</span>
                      <span className={`text-[10px] font-bold uppercase ${p.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>{p.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

function EditForm({ client, onSave, onCancel }: { client: AdminClient; onSave: (p: Partial<AdminClient>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...client });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); onSave(form); }}
    >
      <div>
        <label className="text-[10px] font-bold uppercase block mb-1 text-navy-500 dark:text-navy-400">Name</label>
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white" />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase block mb-1 text-navy-500 dark:text-navy-400">Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white" />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase block mb-1 text-navy-500 dark:text-navy-400">Package</label>
        <select value={form.package} onChange={(e) => setForm((f) => ({ ...f, package: e.target.value as AdminClient['package'] }))} className="w-full px-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white">
          {PACKAGES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold uppercase block mb-1 text-navy-500 dark:text-navy-400">Monthly fee</label>
          <input type="number" value={form.monthlyFee} onChange={(e) => setForm((f) => ({ ...f, monthlyFee: Number(e.target.value) }))} className="w-full px-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase block mb-1 text-navy-500 dark:text-navy-400">Total MRR</label>
          <input type="number" value={form.totalMRR} onChange={(e) => setForm((f) => ({ ...f, totalMRR: Number(e.target.value) }))} className="w-full px-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold uppercase block mb-1 text-navy-500 dark:text-navy-400">Payment status</label>
          <select value={form.paymentStatus} onChange={(e) => setForm((f) => ({ ...f, paymentStatus: e.target.value as PaymentStatus }))} className="w-full px-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white">
            {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase block mb-1 text-navy-500 dark:text-navy-400">Renewal date</label>
          <input type="text" value={form.renewalDate} onChange={(e) => setForm((f) => ({ ...f, renewalDate: e.target.value }))} placeholder="YYYY-MM-DD" className="w-full px-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="setupPaid" checked={form.setupFeePaid} onChange={(e) => setForm((f) => ({ ...f, setupFeePaid: e.target.checked }))} />
        <label htmlFor="setupPaid" className="text-sm text-navy-700 dark:text-navy-300">Setup fee paid</label>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="annual" checked={form.annualPlan} onChange={(e) => setForm((f) => ({ ...f, annualPlan: e.target.checked }))} />
        <label htmlFor="annual" className="text-sm text-navy-700 dark:text-navy-300">Annual plan</label>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="active" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
        <label htmlFor="active" className="text-sm text-navy-700 dark:text-navy-300">Active</label>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase block mb-1 text-navy-500 dark:text-navy-400 flex items-center gap-1"><StickyNote className="w-3 h-3" /> Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="w-full px-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white" />
      </div>
      <div className="flex gap-3 pt-4">
        <button type="submit" className="px-5 py-2.5 rounded-full bg-navy-900 dark:bg-white text-white dark:text-navy-950 text-xs font-bold uppercase tracking-widest">Save</button>
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-full border border-navy-200 dark:border-navy-700 text-navy-700 dark:text-navy-300 text-xs font-bold uppercase tracking-widest">Cancel</button>
      </div>
    </form>
  );
}

function AddForm({ onAdd, onCancel }: { onAdd: (p: Omit<AdminClient, 'id'>) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Omit<AdminClient, 'id'>>({
    name: '',
    email: '',
    package: 'Starter',
    monthlyFee: 497,
    setupFeePaid: false,
    addOns: [],
    totalMRR: 497,
    paymentStatus: 'paid',
    lastPaymentDate: '',
    renewalDate: '',
    annualPlan: false,
    unsubscribeDate: null,
    active: true,
    notes: '',
    paymentHistory: [],
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); onAdd(form); }}
    >
      <div>
        <label className="text-[10px] font-bold uppercase block mb-1 text-navy-500 dark:text-navy-400">Name</label>
        <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white" />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase block mb-1 text-navy-500 dark:text-navy-400">Email</label>
        <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white" />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase block mb-1 text-navy-500 dark:text-navy-400">Package</label>
        <select value={form.package} onChange={(e) => {
          const pkg = e.target.value as AdminClient['package'];
          const fee = pkg === 'Starter' ? 497 : pkg === 'Pro' ? 997 : pkg === 'Enterprise' ? 1997 : 3499;
          setForm((f) => ({ ...f, package: pkg, monthlyFee: fee, totalMRR: fee }));
        }} className="w-full px-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white">
          {PACKAGES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase block mb-1 text-navy-500 dark:text-navy-400">Total MRR</label>
        <input type="number" value={form.totalMRR} onChange={(e) => setForm((f) => ({ ...f, totalMRR: Number(e.target.value) }))} className="w-full px-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white" />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase block mb-1 text-navy-500 dark:text-navy-400">Renewal date</label>
        <input type="text" value={form.renewalDate} onChange={(e) => setForm((f) => ({ ...f, renewalDate: e.target.value }))} placeholder="YYYY-MM-DD" className="w-full px-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white" />
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase block mb-1 text-navy-500 dark:text-navy-400">Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-4 py-2.5 rounded-xl border border-navy-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white" />
      </div>
      <div className="flex gap-3 pt-4">
        <button type="submit" className="px-5 py-2.5 rounded-full bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest">Add client</button>
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-full border border-navy-200 dark:border-navy-700 text-navy-700 dark:text-navy-300 text-xs font-bold uppercase tracking-widest">Cancel</button>
      </div>
    </form>
  );
}
