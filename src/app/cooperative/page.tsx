'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import { Card, Badge, Modal, LoadingSpinner, ConfirmDialog } from '@/components/ui';
import { db, getSettings } from '@/lib/db';
import type {
  CooperativeProfile,
  CooperativeMember,
  CooperativeTransaction,
  CooperativeMeeting,
  CoopMemberRole,
  CoopMemberStatus,
  CoopTxType,
  CoopTxCategory,
  CoopPaymentMethod,
  CoopMeetingType,
} from '@/lib/types';
import {
  COOP_ROLE_LABELS,
  COOP_MEMBER_STATUS_LABELS,
  COOP_TX_TYPE_LABELS,
  COOP_TX_CATEGORY_LABELS,
  COOP_PAYMENT_LABELS,
  COOP_MEETING_TYPE_LABELS,
} from '@/lib/types';
import { formatCurrency, formatPercent, formatDate, todayISO, cn } from '@/lib/utils';
import {
  Building2,
  Users,
  Wallet,
  FileText,
  Plus,
  Edit2,
  Trash2,
  Save,
  Calculator,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  Landmark,
  ShieldCheck,
  FolderDown,
} from 'lucide-react';
import CooperativeDocuments from '@/components/cooperative/CooperativeDocuments';

const INFLOW_TYPES: CoopTxType[] = ['contribution', 'grant', 'coop_sale'];

export default function CooperativePage() {
  const [loading, setLoading] = useState(true);
  const [sym, setSym] = useState('د.م');
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'finance' | 'meetings' | 'documents'>('overview');

  // Data
  const [profile, setProfile] = useState<CooperativeProfile>({
    name: 'تعاونية مراعي الوادي',
    registrationNo: '',
    foundedDate: todayISO(),
    headquarters: 'دوار الخرابشة الأندلس، عين الشقف، مولاي يعقوب، فاس',
    activity: 'تربية الدواجن، تربية المواشي، إنتاج الأعلاف البديلة وتثمينها، وتسويق المنتوجات الفلاحية',
    bankRib: '',
    shareUnitValue: 100,
    legalReserveRate: 10,
    notes: '',
  });
  const [members, setMembers] = useState<CooperativeMember[]>([]);
  const [transactions, setTransactions] = useState<CooperativeTransaction[]>([]);
  const [meetings, setMeetings] = useState<CooperativeMeeting[]>([]);
  const [farmSummary, setFarmSummary] = useState({ sales: 0, expenses: 0, valuation: 0 });

  // Status feedback
  const [profileSaving, setProfileSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [memberStatusFilter, setMemberStatusFilter] = useState<string>('all');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('all');

  // Surplus calculator
  const [surplusToDistribute, setSurplusToDistribute] = useState<number>(5000);

  // Modals
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [deleteMemberId, setDeleteMemberId] = useState<number | null>(null);
  const [memberForm, setMemberForm] = useState<{
    fullName: string;
    cin: string;
    phone: string;
    role: CoopMemberRole;
    joinDate: string;
    sharesCount: number;
    paidCapital: number;
    status: CoopMemberStatus;
    notes: string;
  }>({
    fullName: '',
    cin: '',
    phone: '',
    role: 'member',
    joinDate: todayISO(),
    sharesCount: 5,
    paidCapital: 500,
    status: 'active',
    notes: '',
  });

  const [showTxModal, setShowTxModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [deleteTxId, setDeleteTxId] = useState<number | null>(null);
  const [txForm, setTxForm] = useState<{
    date: string;
    type: CoopTxType;
    category: CoopTxCategory;
    memberId: string;
    amount: number;
    paymentMethod: CoopPaymentMethod;
    referenceNo: string;
    description: string;
    notes: string;
  }>({
    date: todayISO(),
    type: 'contribution',
    category: 'shares',
    memberId: '',
    amount: 500,
    paymentMethod: 'cash',
    referenceNo: '',
    description: '',
    notes: '',
  });

  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<number | null>(null);
  const [deleteMeetingId, setDeleteMeetingId] = useState<number | null>(null);
  const [meetingForm, setMeetingForm] = useState<{
    date: string;
    title: string;
    type: CoopMeetingType;
    attendeesCount: number;
    agenda: string;
    decisions: string;
    status: 'scheduled' | 'completed';
    notes: string;
  }>({
    date: todayISO(),
    title: '',
    type: 'board_meeting',
    attendeesCount: 5,
    agenda: '',
    decisions: '',
    status: 'completed',
    notes: '',
  });

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [s, profArr, mems, txs, meets, sales, exps, vals] = await Promise.all([
        getSettings(),
        db.cooperativeProfile.toArray(),
        db.cooperativeMembers.toArray(),
        db.cooperativeTransactions.toArray(),
        db.cooperativeMeetings.toArray(),
        db.sales.toArray(),
        db.expenses.toArray(),
        db.valuationItems.toArray(),
      ]);
      setSym(s.currencySymbol || 'د.م');
      if (profArr.length > 0) {
        const p = profArr[0];
        setProfile({
          id: p.id,
          name: p.name || 'التعاونية الفلاحية لتربية الدواجن',
          registrationNo: p.registrationNo || '',
          foundedDate: p.foundedDate || todayISO(),
          headquarters: p.headquarters || '',
          activity: p.activity || 'تربية الدجاج البلدي، التفقيس، وإنتاج البيض',
          bankRib: p.bankRib || '',
          shareUnitValue: p.shareUnitValue || 100,
          legalReserveRate: p.legalReserveRate ?? 10,
          notes: p.notes || '',
        });
      }
      setMembers(mems);
      setTransactions(txs);
      setMeetings(meets);
      setFarmSummary({
        sales: sales.reduce((acc, x) => acc + x.total, 0),
        expenses: exps.reduce((acc, x) => acc + x.total, 0),
        valuation: vals.reduce((acc, x) => acc + x.totalValue, 0),
      });
    } catch (err) {
      console.error('Error loading cooperative data:', err);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  }

  // --- حسابات التعاونية المالية ---
  const activeMembers = members.filter(m => m.status === 'active');
  const totalShares = activeMembers.reduce((sum, m) => sum + (m.sharesCount || 0), 0);
  const totalSubscribedCapital = activeMembers.reduce((sum, m) => sum + (m.paidCapital || 0), 0);

  const totalInflows = transactions
    .filter(t => INFLOW_TYPES.includes(t.type))
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOutflows = transactions
    .filter(t => !INFLOW_TYPES.includes(t.type))
    .reduce((sum, t) => sum + t.amount, 0);
  const treasuryBalance = totalInflows - totalOutflows;
  const totalGrantsAndCoopSales = transactions
    .filter(t => t.type === 'grant' || t.type === 'coop_sale')
    .reduce((sum, t) => sum + t.amount, 0);

  const legalReserveAmount = (Math.max(0, surplusToDistribute) * (profile.legalReserveRate || 10)) / 100;
  const netDistributableSurplus = Math.max(0, surplusToDistribute - legalReserveAmount);

  // --- حفظ الملف التنظيمي للتعاونية ---
  async function saveProfile() {
    setProfileSaving(true);
    try {
      const { id, ...rest } = profile;
      if (id) {
        await db.cooperativeProfile.update(id, rest);
      } else {
        await db.cooperativeProfile.add(rest);
      }
      await loadAll();
      showToast('✅ تم حفظ بطاقة التعاونية التنظيمية بنجاح');
    } catch (err) {
      console.error(err);
      showToast('❌ تعذر حفظ بيانات التعاونية');
    } finally {
      setProfileSaving(false);
    }
  }

  // --- دوال المنخرطين ---
  function openAddMember() {
    const unitVal = profile.shareUnitValue || 100;
    setEditingMemberId(null);
    setMemberForm({
      fullName: '',
      cin: '',
      phone: '',
      role: 'member',
      joinDate: todayISO(),
      sharesCount: 5,
      paidCapital: 5 * unitVal,
      status: 'active',
      notes: '',
    });
    setShowMemberModal(true);
  }

  function openEditMember(m: CooperativeMember) {
    setEditingMemberId(m.id || null);
    setMemberForm({
      fullName: m.fullName,
      cin: m.cin || '',
      phone: m.phone || '',
      role: m.role,
      joinDate: m.joinDate,
      sharesCount: m.sharesCount,
      paidCapital: m.paidCapital,
      status: m.status,
      notes: m.notes || '',
    });
    setShowMemberModal(true);
  }

  async function saveMember() {
    if (!memberForm.fullName.trim()) return;
    if (editingMemberId) {
      await db.cooperativeMembers.update(editingMemberId, memberForm);
    } else {
      await db.cooperativeMembers.add(memberForm);
    }
    setShowMemberModal(false);
    await loadAll();
    showToast(editingMemberId ? '✅ تم تحديث بيانات المنخرط' : '✅ تمت إضافة المنخرط للتعاونية');
  }

  async function confirmDeleteMember() {
    if (deleteMemberId) {
      await db.cooperativeMembers.delete(deleteMemberId);
      setDeleteMemberId(null);
      loadAll();
    }
  }

  // --- دوال المعاملات المالية للصندوق ---
  function openAddTx(defaultType: CoopTxType = 'contribution') {
    setEditingTxId(null);
    setTxForm({
      date: todayISO(),
      type: defaultType,
      category: defaultType === 'contribution' ? 'shares' : defaultType === 'grant' ? 'subsidy' : 'other',
      memberId: '',
      amount: 500,
      paymentMethod: 'cash',
      referenceNo: '',
      description: '',
      notes: '',
    });
    setShowTxModal(true);
  }

  function openEditTx(tx: CooperativeTransaction) {
    setEditingTxId(tx.id || null);
    setTxForm({
      date: tx.date,
      type: tx.type,
      category: tx.category,
      memberId: tx.memberId ? String(tx.memberId) : '',
      amount: tx.amount,
      paymentMethod: tx.paymentMethod,
      referenceNo: tx.referenceNo || '',
      description: tx.description,
      notes: tx.notes || '',
    });
    setShowTxModal(true);
  }

  async function saveTx() {
    if (!txForm.description.trim() || txForm.amount <= 0) return;
    const selectedMember = txForm.memberId ? members.find(m => m.id === Number(txForm.memberId)) : undefined;
    const payload = {
      date: txForm.date,
      type: txForm.type,
      category: txForm.category,
      memberId: selectedMember?.id || null,
      memberName: selectedMember?.fullName || null,
      amount: Number(txForm.amount),
      paymentMethod: txForm.paymentMethod,
      referenceNo: txForm.referenceNo,
      description: txForm.description,
      notes: txForm.notes,
    };
    if (editingTxId) {
      await db.cooperativeTransactions.update(editingTxId, payload);
    } else {
      await db.cooperativeTransactions.add(payload);
    }
    setShowTxModal(false);
    await loadAll();
    showToast('✅ تم تسجيل الحركة المالية في صندوق التعاونية');
  }

  async function recordSurplusDistributionTx() {
    if (netDistributableSurplus <= 0 || activeMembers.length === 0) return;
    await db.cooperativeTransactions.add({
      date: todayISO(),
      type: 'profit_distribution',
      category: 'shares',
      memberId: null,
      memberName: `${activeMembers.length} منخرطين`,
      amount: Math.round(netDistributableSurplus * 100) / 100,
      paymentMethod: 'cash',
      referenceNo: `DIST-${todayISO().replaceAll('-', '')}`,
      description: `توزيع الفائض الصافي على ${activeMembers.length} منخرطين (بعد خصم ${profile.legalReserveRate}% احتياطي قانوني)`,
      notes: `إجمالي الفائض: ${surplusToDistribute} ${sym} | الاحتياطي القانوني: ${legalReserveAmount.toFixed(2)} ${sym}`,
    });
    await loadAll();
    showToast('✅ تم قيد عملية توزيع الفائض في سجل الصندوق');
  }

  async function confirmDeleteTx() {
    if (deleteTxId) {
      await db.cooperativeTransactions.delete(deleteTxId);
      setDeleteTxId(null);
      loadAll();
    }
  }

  // --- دوال الاجتماعات والمحاضر ---
  function openAddMeeting() {
    setEditingMeetingId(null);
    setMeetingForm({
      date: todayISO(),
      title: '',
      type: 'board_meeting',
      attendeesCount: activeMembers.length || 5,
      agenda: '',
      decisions: '',
      status: 'completed',
      notes: '',
    });
    setShowMeetingModal(true);
  }

  function openEditMeeting(meet: CooperativeMeeting) {
    setEditingMeetingId(meet.id || null);
    setMeetingForm({
      date: meet.date,
      title: meet.title,
      type: meet.type,
      attendeesCount: meet.attendeesCount,
      agenda: meet.agenda,
      decisions: meet.decisions || '',
      status: meet.status,
      notes: meet.notes || '',
    });
    setShowMeetingModal(true);
  }

  async function saveMeeting() {
    if (!meetingForm.title.trim()) return;
    if (editingMeetingId) {
      await db.cooperativeMeetings.update(editingMeetingId, meetingForm);
    } else {
      await db.cooperativeMeetings.add(meetingForm);
    }
    setShowMeetingModal(false);
    await loadAll();
    showToast('✅ تم حفظ محضر الاجتماع بنجاح');
  }

  async function confirmDeleteMeeting() {
    if (deleteMeetingId) {
      await db.cooperativeMeetings.delete(deleteMeetingId);
      setDeleteMeetingId(null);
      loadAll();
    }
  }

  if (loading) return <AppShell><LoadingSpinner /></AppShell>;

  const filteredMembers = memberStatusFilter === 'all' ? members : members.filter(m => m.status === memberStatusFilter);
  const filteredTxs = txTypeFilter === 'all' ? transactions : transactions.filter(t => t.type === txTypeFilter);

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <Building2 className="w-7 h-7 text-blue-600" />
              {profile.name}
            </h1>
            {profile.registrationNo && <Badge color="blue">سجل رقم: {profile.registrationNo}</Badge>}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            التسيير الإداري والمالي للتعاونية: المنخرطون، الحصص، الصندوق، المحاضر، وتوزيع الفائض
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={openAddMember}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            منخرط جديد
          </button>
          <button
            onClick={() => openAddTx('contribution')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            حركة صندوق
          </button>
          <button
            onClick={openAddMeeting}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition shadow-sm"
          >
            <Plus className="w-4 h-4 text-purple-600" />
            محضر اجتماع
          </button>
        </div>
      </div>

      {notice && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-sm">
          {notice}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className={cn('p-5 text-white shadow-md bg-gradient-to-br', treasuryBalance >= 0 ? 'from-emerald-600 to-emerald-800' : 'from-red-600 to-red-800')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-100">رصيد صندوق التعاونية</span>
            <span className="p-2 bg-white/20 rounded-lg"><Landmark className="w-5 h-5" /></span>
          </div>
          <p className="text-2xl md:text-3xl font-black">{formatCurrency(treasuryBalance, sym)}</p>
          <p className="text-xs text-emerald-100 mt-1">
            مداخيل: {formatCurrency(totalInflows, sym)} • مصاريف: {formatCurrency(totalOutflows, sym)}
          </p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-700">الأعضاء المنخرطون</span>
            <span className="p-2 bg-blue-100 rounded-lg text-blue-600"><Users className="w-4 h-4" /></span>
          </div>
          <p className="text-3xl font-black text-blue-900">{activeMembers.length} <span className="text-sm font-normal text-slate-500">عضو نشط</span></p>
          <p className="text-xs text-slate-500 mt-1">{totalShares} حصة ({formatCurrency(totalSubscribedCapital, sym)})</p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-amber-50 to-white border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-700">الدعم والمبيعات الجماعية</span>
            <span className="p-2 bg-amber-100 rounded-lg text-amber-600"><Wallet className="w-4 h-4" /></span>
          </div>
          <p className="text-2xl md:text-3xl font-black text-amber-900">{formatCurrency(totalGrantsAndCoopSales, sym)}</p>
          <p className="text-xs text-slate-500 mt-1">تمويل وتعاون جماعي مسجل</p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-purple-50 to-white border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-700">الجموع والمحاضر</span>
            <span className="p-2 bg-purple-100 rounded-lg text-purple-600"><FileText className="w-4 h-4" /></span>
          </div>
          <p className="text-3xl font-black text-purple-900">{meetings.length} <span className="text-sm font-normal text-slate-500">محضر</span></p>
          <p className="text-xs text-slate-500 mt-1">
            {meetings.filter(m => m.status === 'completed').length} منعقد • {meetings.filter(m => m.status === 'scheduled').length} مبرمج
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 mb-6 gap-2">
        {[
          { id: 'overview', label: 'الملف التنظيمي وتوزيع الفائض', icon: Calculator },
          { id: 'documents', label: 'وثائق التأسيس والقوانين (4 ملفات)', icon: FolderDown },
          { id: 'members', label: `المنخرطون والمكتب (${members.length})`, icon: Users },
          { id: 'finance', label: `صندوق التعاونية (${transactions.length})`, icon: Wallet },
          { id: 'meetings', label: `الاجتماعات والمحاضر (${meetings.length})`, icon: FileText },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={cn(
                'px-4 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2',
                activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Overview, Legal Profile & Surplus Distributor */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* بطاقة الملف التنظيمي للتعاونية */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                البطاقة التنظيمية والقانونية للتعاونية
              </h3>
              <button
                onClick={saveProfile}
                disabled={profileSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                <Save className="w-3.5 h-3.5" />
                {profileSaving ? 'جاري الحفظ...' : 'حفظ البيانات'}
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">اسم التعاونية</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">رقم التسجيل بالسجل المحلي</label>
                  <input
                    type="text"
                    value={profile.registrationNo || ''}
                    onChange={e => setProfile(p => ({ ...p, registrationNo: e.target.value }))}
                    placeholder="مثلاً: 2026/112-12"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">تاريخ التأسيس</label>
                  <input
                    type="date"
                    value={profile.foundedDate || ''}
                    onChange={e => setProfile(p => ({ ...p, foundedDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">النشاط الرئيسي</label>
                <input
                  type="text"
                  value={profile.activity}
                  onChange={e => setProfile(p => ({ ...p, activity: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">المقر / الجماعة</label>
                  <input
                    type="text"
                    value={profile.headquarters || ''}
                    onChange={e => setProfile(p => ({ ...p, headquarters: e.target.value }))}
                    placeholder="العنوان أو الإقليم"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">رقم الحساب البنكي (RIB)</label>
                  <input
                    type="text"
                    value={profile.bankRib || ''}
                    onChange={e => setProfile(p => ({ ...p, bankRib: e.target.value }))}
                    placeholder="24 رقماً"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-blue-700 mb-1">قيمة الحصة الواحدة ({sym})</label>
                  <input
                    type="number"
                    min="1"
                    value={profile.shareUnitValue}
                    onChange={e => setProfile(p => ({ ...p, shareUnitValue: Math.max(1, +e.target.value || 100) }))}
                    className="w-full px-3 py-1.5 border border-blue-300 rounded-lg bg-white font-bold text-blue-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-emerald-700 mb-1">نسبة الاحتياطي القانوني (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={profile.legalReserveRate}
                    onChange={e => setProfile(p => ({ ...p, legalReserveRate: Math.max(0, Math.min(50, +e.target.value || 0)) }))}
                    className="w-full px-3 py-1.5 border border-emerald-300 rounded-lg bg-white font-bold text-emerald-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">ملاحظات النظام الداخلي</label>
                <textarea
                  rows={2}
                  value={profile.notes || ''}
                  onChange={e => setProfile(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </Card>

          {/* حاسبة توزيع الفائض السنوي وربط أصول المشروع */}
          <div className="space-y-6">
            <Card className="p-5">
              <h3 className="font-bold text-lg text-slate-800 mb-3 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-600" />
                حاسبة توزيع الفائض السنوي على المنخرطين
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                يُخصم الاحتياطي القانوني ({profile.legalReserveRate}%) تلقائياً وفق قانون التعاونيات، ويوزَّع الباقي حسب حصص كل عضو.
              </p>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">الفائض الصافي ({sym})</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={surplusToDistribute}
                    onChange={e => setSurplusToDistribute(Math.max(0, +e.target.value || 0))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-center">
                  <span className="text-[11px] text-amber-700 block">الاحتياطي القانوني ({profile.legalReserveRate}%)</span>
                  <span className="text-base font-black text-amber-900">{formatCurrency(legalReserveAmount, sym)}</span>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[11px] text-emerald-700 block">الصافي للتوزيع</span>
                  <span className="text-base font-black text-emerald-900">{formatCurrency(netDistributableSurplus, sym)}</span>
                </div>
              </div>

              {activeMembers.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-sm text-slate-500">
                  أضف أعضاءً منخرطين وحصصهم لعرض جدول توزيع الأرباح لكل عضو.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl mb-3">
                    <table className="w-full text-right text-xs md:text-sm">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">المنخرط</th>
                          <th className="p-2.5">الصفة</th>
                          <th className="p-2.5">الحصص</th>
                          <th className="p-2.5">النسبة</th>
                          <th className="p-2.5">نصيبه من الفائض</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeMembers.map(m => {
                          const sharePct = totalShares > 0 ? (m.sharesCount / totalShares) * 100 : 0;
                          const memberCut = totalShares > 0 ? (netDistributableSurplus * m.sharesCount) / totalShares : 0;
                          return (
                            <tr key={m.id}>
                              <td className="p-2.5 font-bold text-slate-800">{m.fullName}</td>
                              <td className="p-2.5 text-xs text-slate-500">{COOP_ROLE_LABELS[m.role]}</td>
                              <td className="p-2.5 font-medium">{m.sharesCount}</td>
                              <td className="p-2.5">{formatPercent(sharePct)}</td>
                              <td className="p-2.5 font-black text-emerald-700">{formatCurrency(memberCut, sym)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={recordSurplusDistributionTx}
                    className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition"
                  >
                    قيد التوزيع كعملية صرف في صندوق التعاونية ({formatCurrency(netDistributableSurplus, sym)})
                  </button>
                </>
              )}
            </Card>

            {/* ربط مع المؤشرات المالية للمزرعة */}
            <Card className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
              <h3 className="font-bold text-base mb-3">🔗 ملخص وضعية مشروع الدواجن المرتبط</h3>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="bg-white/10 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-300 block">قيمة أصول المزرعة</span>
                  <span className="font-black text-emerald-300">{formatCurrency(farmSummary.valuation, sym)}</span>
                </div>
                <div className="bg-white/10 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-300 block">مبيعات الإنتاج</span>
                  <span className="font-black text-blue-300">{formatCurrency(farmSummary.sales, sym)}</span>
                </div>
                <div className="bg-white/10 p-3 rounded-xl">
                  <span className="text-[11px] text-slate-300 block">مصاريف المزرعة</span>
                  <span className="font-black text-red-300">{formatCurrency(farmSummary.expenses, sym)}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: Members */}
      {activeTab === 'members' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex gap-2">
              {(['all', 'active', 'suspended', 'exited'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setMemberStatusFilter(st)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition',
                    memberStatusFilter === st ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                  )}
                >
                  {st === 'all' ? `الكل (${members.length})` : COOP_MEMBER_STATUS_LABELS[st]}
                </button>
              ))}
            </div>
            <button
              onClick={openAddMember}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              إضافة منخرط
            </button>
          </div>

          {filteredMembers.length === 0 ? (
            <Card className="p-10 text-center">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 mb-1">لا يوجد أعضاء منخرطون مسجلون حالياً</h3>
              <p className="text-sm text-slate-500 mb-4">سجّل أعضاء المكتب المسير والمنخرطين وحصصهم في التعاونية</p>
              <button onClick={openAddMember} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold">
                إضافة أول عضو
              </button>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMembers.map(m => {
                const sharePct = m.status === 'active' && totalShares > 0 ? (m.sharesCount / totalShares) * 100 : 0;
                return (
                  <Card key={m.id} className="p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-lg text-slate-800">{m.fullName}</h3>
                          <p className="text-xs text-slate-500">{COOP_ROLE_LABELS[m.role]}</p>
                        </div>
                        <Badge color={m.status === 'active' ? 'green' : m.status === 'suspended' ? 'amber' : 'red'}>
                          {COOP_MEMBER_STATUS_LABELS[m.status]}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3 text-center">
                        <div>
                          <span className="text-[11px] text-slate-500 block">الحصص</span>
                          <span className="font-black text-blue-700">{m.sharesCount}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">النسبة</span>
                          <span className="font-black text-purple-700">{formatPercent(sharePct)}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">المساهمة</span>
                          <span className="font-black text-emerald-700">{formatCurrency(m.paidCapital, sym)}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-600">
                        {m.cin && <div className="flex justify-between"><span>🪪 البطاقة الوطنية:</span><span className="font-medium">{m.cin}</span></div>}
                        {m.phone && <div className="flex justify-between"><span>📞 الهاتف:</span><span className="font-medium">{m.phone}</span></div>}
                        <div className="flex justify-between"><span>📅 تاريخ الانخراط:</span><span className="font-medium">{formatDate(m.joinDate)}</span></div>
                        {m.notes && <p className="bg-slate-50 p-2 rounded-lg text-slate-500 mt-2">{m.notes}</p>}
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400">عضو #{m.id}</span>
                      <div className="flex gap-1">
                        <button onClick={() => openEditMember(m)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg" title="تعديل">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteMemberId(m.id!)} className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg" title="حذف">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Finance & Treasury */}
      {activeTab === 'finance' && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-lg text-slate-800">سجل صندوق التعاونية</h3>
              <select
                value={txTypeFilter}
                onChange={e => setTxTypeFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium"
              >
                <option value="all">كل الحركات ({transactions.length})</option>
                {Object.entries(COOP_TX_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => openAddTx('contribution')}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
            >
              <Plus className="w-4 h-4" />
              تسجيل حركة مالية
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs border-b border-slate-200">
                <tr>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">نوع الحركة</th>
                  <th className="p-3">التصنيف</th>
                  <th className="p-3">الوصف</th>
                  <th className="p-3">العضو المرتبط</th>
                  <th className="p-3">الأداء</th>
                  <th className="p-3">المبلغ</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTxs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      لا توجد معاملات مالية مسجلة في صندوق التعاونية بعد
                    </td>
                  </tr>
                ) : (
                  filteredTxs.map(tx => {
                    const isInflow = INFLOW_TYPES.includes(tx.type);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="p-3 whitespace-nowrap">{formatDate(tx.date)}</td>
                        <td className="p-3">
                          <Badge color={isInflow ? 'green' : 'red'}>
                            <span className="flex items-center gap-1">
                              {isInflow ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
                              {COOP_TX_TYPE_LABELS[tx.type]}
                            </span>
                          </Badge>
                        </td>
                        <td className="p-3 text-xs">{COOP_TX_CATEGORY_LABELS[tx.category]}</td>
                        <td className="p-3 font-medium text-slate-800">{tx.description}</td>
                        <td className="p-3 text-xs text-slate-500">{tx.memberName || '—'}</td>
                        <td className="p-3 text-xs text-slate-500">
                          {COOP_PAYMENT_LABELS[tx.paymentMethod]} {tx.referenceNo ? `(${tx.referenceNo})` : ''}
                        </td>
                        <td className={cn('p-3 font-black whitespace-nowrap', isInflow ? 'text-emerald-700' : 'text-red-600')}>
                          {isInflow ? '+' : '-'} {formatCurrency(tx.amount, sym)}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEditTx(tx)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteTxId(tx.id!)} className="p-1.5 text-slate-500 hover:text-red-600 rounded">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: Meetings & Minutes */}
      {activeTab === 'meetings' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-slate-800">سجل الاجتماعات والجموع العامة والمحاضر</h3>
            <button
              onClick={openAddMeeting}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition"
            >
              <Plus className="w-4 h-4" />
              إضافة اجتماع / محضر
            </button>
          </div>

          {meetings.length === 0 ? (
            <Card className="p-10 text-center">
              <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 mb-1">لا توجد محاضر اجتماعات مسجلة</h3>
              <p className="text-sm text-slate-500 mb-4">وثّق اجتماعات المكتب المسير والجموع العامة وقرارات الشراء والتسويق المشترك</p>
              <button onClick={openAddMeeting} className="px-5 py-2.5 bg-purple-600 text-white rounded-xl font-bold">
                تسجيل أول محضر
              </button>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {meetings.map(meet => (
                <Card key={meet.id} className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h4 className="font-bold text-base text-slate-800">{meet.title}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          📅 {formatDate(meet.date)} • 👥 {meet.attendeesCount} حاضرين
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <Badge color="purple">{COOP_MEETING_TYPE_LABELS[meet.type]}</Badge>
                        <Badge color={meet.status === 'completed' ? 'green' : 'amber'}>
                          {meet.status === 'completed' ? 'منعقد' : 'مبرمج'}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="font-bold text-slate-700 block mb-1">جدول الأعمال:</span>
                        <p className="text-slate-600 whitespace-pre-line">{meet.agenda}</p>
                      </div>
                      {meet.decisions && (
                        <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
                          <span className="font-bold text-emerald-800 block mb-1">القرارات والملخص:</span>
                          <p className="text-emerald-900 whitespace-pre-line">{meet.decisions}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-100 flex justify-end gap-1">
                    <button onClick={() => openEditMeeting(meet)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteMeetingId(meet.id!)} className="p-1.5 text-slate-500 hover:text-red-600 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Founding Legal Documents (4 Documents) */}
      {activeTab === 'documents' && (
        <CooperativeDocuments profile={profile} members={members} />
      )}

      {/* Modal: Add/Edit Member */}
      <Modal isOpen={showMemberModal} onClose={() => setShowMemberModal(false)} title={editingMemberId ? 'تعديل بيانات المنخرط' : 'إضافة عضو منخرط'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل</label>
              <input type="text" value={memberForm.fullName} onChange={e => setMemberForm(p => ({ ...p, fullName: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الصفة في التعاونية</label>
              <select value={memberForm.role} onChange={e => setMemberForm(p => ({ ...p, role: e.target.value as CoopMemberRole }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {Object.entries(COOP_ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم البطاقة (CIN)</label>
              <input type="text" value={memberForm.cin} onChange={e => setMemberForm(p => ({ ...p, cin: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الهاتف</label>
              <input type="text" value={memberForm.phone} onChange={e => setMemberForm(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الانخراط</label>
              <input type="date" value={memberForm.joinDate} onChange={e => setMemberForm(p => ({ ...p, joinDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-blue-700 mb-1">عدد الحصص</label>
              <input
                type="number"
                min="1"
                value={memberForm.sharesCount}
                onChange={e => {
                  const sh = Math.max(0, +e.target.value || 0);
                  setMemberForm(p => ({ ...p, sharesCount: sh, paidCapital: sh * (profile.shareUnitValue || 100) }));
                }}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm font-bold bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-700 mb-1">المساهمة المدفوعة ({sym})</label>
              <input
                type="number"
                min="0"
                value={memberForm.paidCapital}
                onChange={e => setMemberForm(p => ({ ...p, paidCapital: Math.max(0, +e.target.value || 0) }))}
                className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm font-bold bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الحالة</label>
              <select value={memberForm.status} onChange={e => setMemberForm(p => ({ ...p, status: e.target.value as CoopMemberStatus }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                {Object.entries(COOP_MEMBER_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات</label>
            <textarea rows={2} value={memberForm.notes} onChange={e => setMemberForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowMemberModal(false)} className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700">إلغاء</button>
            <button onClick={saveMember} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">حفظ</button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add/Edit Transaction */}
      <Modal isOpen={showTxModal} onClose={() => setShowTxModal(false)} title={editingTxId ? 'تعديل حركة مالية' : 'تسجيل حركة بصندوق التعاونية'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ</label>
              <input type="date" value={txForm.date} onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نوع العملية</label>
              <select value={txForm.type} onChange={e => setTxForm(p => ({ ...p, type: e.target.value as CoopTxType }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {Object.entries(COOP_TX_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف</label>
              <select value={txForm.category} onChange={e => setTxForm(p => ({ ...p, category: e.target.value as CoopTxCategory }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {Object.entries(COOP_TX_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">العضو المرتبط (اختياري)</label>
              <select value={txForm.memberId} onChange={e => setTxForm(p => ({ ...p, memberId: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">عام للتعاونية</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-emerald-700 mb-1">المبلغ ({sym})</label>
              <input type="number" step="0.5" min="0" value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: +e.target.value }))} className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm font-bold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الأداء</label>
              <select value={txForm.paymentMethod} onChange={e => setTxForm(p => ({ ...p, paymentMethod: e.target.value as CoopPaymentMethod }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {Object.entries(COOP_PAYMENT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم الوصل/المرجع</label>
              <input type="text" value={txForm.referenceNo} onChange={e => setTxForm(p => ({ ...p, referenceNo: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">الوصف</label>
            <input type="text" value={txForm.description} onChange={e => setTxForm(p => ({ ...p, description: e.target.value }))} placeholder="مثلاً: واجب الانخراط أو شراء علف جماعي..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowTxModal(false)} className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700">إلغاء</button>
            <button onClick={saveTx} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700">حفظ</button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add/Edit Meeting */}
      <Modal isOpen={showMeetingModal} onClose={() => setShowMeetingModal(false)} title={editingMeetingId ? 'تعديل محضر الاجتماع' : 'تسجيل اجتماع / جمع عام'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">عنوان الاجتماع</label>
            <input type="text" value={meetingForm.title} onChange={e => setMeetingForm(p => ({ ...p, title: e.target.value }))} placeholder="مثلاً: الجمع العام التأسيسي أو اجتماع خطة التوسع" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ</label>
              <input type="date" value={meetingForm.date} onChange={e => setMeetingForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">النوع</label>
              <select value={meetingForm.type} onChange={e => setMeetingForm(p => ({ ...p, type: e.target.value as CoopMeetingType }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                {Object.entries(COOP_MEETING_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الحضور / الحالة</label>
              <div className="flex gap-1.5">
                <input type="number" min="0" value={meetingForm.attendeesCount} onChange={e => setMeetingForm(p => ({ ...p, attendeesCount: +e.target.value }))} className="w-16 px-2 py-2 border border-slate-300 rounded-lg text-sm text-center" />
                <select value={meetingForm.status} onChange={e => setMeetingForm(p => ({ ...p, status: e.target.value as 'scheduled' | 'completed' }))} className="flex-1 px-2 py-2 border border-slate-300 rounded-lg text-xs">
                  <option value="completed">منعقد</option>
                  <option value="scheduled">مبرمج</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">جدول الأعمال</label>
            <textarea rows={2} value={meetingForm.agenda} onChange={e => setMeetingForm(p => ({ ...p, agenda: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">القرارات المتخذة (المحضر)</label>
            <textarea rows={3} value={meetingForm.decisions} onChange={e => setMeetingForm(p => ({ ...p, decisions: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowMeetingModal(false)} className="flex-1 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-700">إلغاء</button>
            <button onClick={saveMeeting} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700">حفظ المحضر</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={deleteMemberId !== null} onClose={() => setDeleteMemberId(null)} onConfirm={confirmDeleteMember} title="حذف المنخرط" message="هل أنت متأكد من حذف هذا العضو من لائحة التعاونية؟" confirmLabel="حذف" confirmColor="red" />
      <ConfirmDialog isOpen={deleteTxId !== null} onClose={() => setDeleteTxId(null)} onConfirm={confirmDeleteTx} title="حذف الحركة المالية" message="هل أنت متأكد من حذف هذه المعاملة من صندوق التعاونية؟" confirmLabel="حذف" confirmColor="red" />
      <ConfirmDialog isOpen={deleteMeetingId !== null} onClose={() => setDeleteMeetingId(null)} onConfirm={confirmDeleteMeeting} title="حذف المحضر" message="هل أنت متأكد من حذف محضر هذا الاجتماع؟" confirmLabel="حذف" confirmColor="red" />
    </AppShell>
  );
}
