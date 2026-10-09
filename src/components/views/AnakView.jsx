import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import { useI18n } from '../../i18n/I18nContext';
import {
  calcAge, formatAge, subscribeKids, createKid, updateKid, deleteKid,
  subscribeMilestones, addMilestone, deleteMilestone,
  subscribeLogs, addLog, deleteLog,
  subscribeCurriculum, addCurriculumItem, toggleCurriculumItem, deleteCurriculumItem,
  PRESET_MILESTONES, PRESET_CURRICULUM, pickPresetBucket,
} from '../../services/kids';

const TABS = ['overview', 'milestones', 'logs', 'curriculum'];

// ─── Kid profile modal ─────────────────────────────────────────
function KidFormModal({ open, onClose, onSave, initial }) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name || '');
  const [dob, setDob] = useState(() => {
    if (!initial?.dob) return '';
    const d = initial.dob.toDate ? initial.dob.toDate() : new Date(initial.dob);
    return d.toISOString().slice(0, 10);
  });
  const [gender, setGender] = useState(initial?.gender || 'F');
  const [notes, setNotes] = useState(initial?.notes || '');

  useEffect(() => {
    if (open) {
      setName(initial?.name || '');
      setDob(initial?.dob ? (initial.dob.toDate ? initial.dob.toDate() : new Date(initial.dob)).toISOString().slice(0, 10) : '');
      setGender(initial?.gender || 'F');
      setNotes(initial?.notes || '');
    }
  }, [open, initial]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !dob) return;
    onSave({ name: name.trim(), dob: new Date(dob), gender, notes });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
          {initial ? t('kids.editKid') : t('kids.addKid')}
        </h2>
        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.form.name')} *</span>
          <input value={name} onChange={e => setName(e.target.value)} required
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.form.dob')} *</span>
          <input type="date" value={dob} onChange={e => setDob(e.target.value)} required
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.form.gender')}</span>
          <select value={gender} onChange={e => setGender(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
            <option value="F">{t('kids.form.genderF')}</option>
            <option value="M">{t('kids.form.genderM')}</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.form.notes')}</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            {t('kids.form.cancel')}
          </button>
          <button type="submit"
            className="px-4 py-2 text-sm bg-primary text-on-primary rounded-lg hover:opacity-90 font-semibold">
            {t('kids.form.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Milestone modal ───────────────────────────────────────────
function MilestoneModal({ open, onClose, onSave, presets = [] }) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('motorik');
  const [achievedAt, setAchievedAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [useCustom, setUseCustom] = useState(presets.length === 0);

  useEffect(() => {
    if (open) {
      setTitle('');
      setCategory('motorik');
      setAchievedAt(new Date().toISOString().slice(0, 10));
      setNotes('');
      setUseCustom(presets.length === 0);
    }
  }, [open, presets]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), category, achievedAt, notes });
  };

  const CATS = [
    { v: 'motorik',  l: t('kids.milestone.catMotorik') },
    { v: 'bahasa',   l: t('kids.milestone.catBahasa') },
    { v: 'sosial',   l: t('kids.milestone.catSosial') },
    { v: 'kognitif', l: t('kids.milestone.catKognitif') },
    { v: 'lainnya',  l: t('kids.milestone.catLainnya') },
  ];

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('kids.milestone.addTitle')}</h2>

        {presets.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{t('kids.milestone.suggest')}</p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {presets.map((p, i) => (
                <button type="button" key={i}
                  onClick={() => { setTitle(p.title); setCategory(p.category); setUseCustom(true); }}
                  className="text-xs px-2.5 py-1 rounded-full bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800 hover:bg-pink-100 dark:hover:bg-pink-900/50">
                  + {p.title}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setUseCustom(!useCustom)}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 underline">
              {useCustom ? '↑ Pilih dari saran' : t('kids.milestone.addCustom')}
            </button>
          </div>
        )}

        {useCustom && (
          <>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.milestone.title')} *</span>
              <input value={title} onChange={e => setTitle(e.target.value)} required
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.milestone.category')}</span>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
                {CATS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </label>
          </>
        )}

        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.milestone.achievedAt')}</span>
          <input type="date" value={achievedAt} onChange={e => setAchievedAt(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.milestone.notes')}</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            {t('kids.form.cancel')}
          </button>
          <button type="submit"
            className="px-4 py-2 text-sm bg-primary text-on-primary rounded-lg hover:opacity-90 font-semibold">
            {t('kids.form.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Daily log modal ───────────────────────────────────────────
function LogModal({ open, onClose, onSave }) {
  const { t } = useI18n();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mood, setMood] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10));
      setMood(''); setWeightKg(''); setHeightCm(''); setNote('');
    }
  }, [open]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    onSave({
      date, mood, weightKg: weightKg ? Number(weightKg) : null, heightCm: heightCm ? Number(heightCm) : null, note,
    });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('kids.log.addLog')}</h2>
        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.log.date')}</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.log.weightKg')}</span>
            <input type="number" step="0.1" min="0" value={weightKg} onChange={e => setWeightKg(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.log.heightCm')}</span>
            <input type="number" step="0.5" min="0" value={heightCm} onChange={e => setHeightCm(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.log.mood')}</span>
          <input value={mood} onChange={e => setMood(e.target.value)}
            placeholder="😊 Ceria, sedikit rewel, dll."
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.log.note')}</span>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            {t('kids.form.cancel')}
          </button>
          <button type="submit"
            className="px-4 py-2 text-sm bg-primary text-on-primary rounded-lg hover:opacity-90 font-semibold">
            {t('kids.form.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Curriculum modal ──────────────────────────────────────────
function CurriculumModal({ open, onClose, onSave, presets = [] }) {
  const { t } = useI18n();
  const [subject, setSubject] = useState('');
  const [goal, setGoal] = useState('');
  const [schedule, setSchedule] = useState('');
  const [notes, setNotes] = useState('');
  const [useCustom, setUseCustom] = useState(presets.length === 0);

  useEffect(() => {
    if (open) {
      setSubject(''); setGoal(''); setSchedule(''); setNotes('');
      setUseCustom(presets.length === 0);
    }
  }, [open, presets]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!subject.trim()) return;
    onSave({ subject: subject.trim(), goal, schedule, notes });
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('kids.curriculum.addSubject')}</h2>

        {presets.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{t('kids.curriculum.suggest')}</p>
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {presets.map((p, i) => (
                <button type="button" key={i}
                  onClick={() => { setSubject(p.subject); setGoal(p.goal || ''); setSchedule(p.schedule || ''); setUseCustom(true); }}
                  className="text-left text-xs px-3 py-2 rounded-lg bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800 hover:bg-pink-100 dark:hover:bg-pink-900/50">
                  <strong>+ {p.subject}</strong>
                  {p.goal && <span className="block text-[11px] opacity-75">{p.goal}</span>}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setUseCustom(!useCustom)}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 underline">
              {useCustom ? '↑ Pilih dari saran' : t('kids.curriculum.addCustom')}
            </button>
          </div>
        )}

        {useCustom && (
          <>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.curriculum.subject')} *</span>
              <input value={subject} onChange={e => setSubject(e.target.value)} required
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.curriculum.goal')}</span>
              <input value={goal} onChange={e => setGoal(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.curriculum.schedule')}</span>
              <input value={schedule} onChange={e => setSchedule(e.target.value)} placeholder="Senin & Kamis, 30 menit"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
            </label>
          </>
        )}

        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('kids.curriculum.notes')}</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200" />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            {t('kids.form.cancel')}
          </button>
          <button type="submit"
            className="px-4 py-2 text-sm bg-primary text-on-primary rounded-lg hover:opacity-90 font-semibold">
            {t('kids.form.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Preset helpers for current age ────────────────────────────
function getMilestonePresetsForAge(totalMonths) {
  if (totalMonths <= 12) return PRESET_MILESTONES['0-12'];
  if (totalMonths <= 24) return PRESET_MILESTONES['13-36']['1-2'];
  if (totalMonths <= 36) return PRESET_MILESTONES['13-36']['2-3'];
  if (totalMonths <= 48) return PRESET_MILESTONES['37-72']['3-4'];
  if (totalMonths <= 60) return PRESET_MILESTONES['37-72']['4-5'];
  return PRESET_MILESTONES['37-72']['5-6'];
}

// ─── Main view ─────────────────────────────────────────────────
export default function AnakView({ dataOwnerId, ownerType, appId }) {
  const owner = useMemo(() => (dataOwnerId && ownerType ? { type: ownerType, id: dataOwnerId } : null), [dataOwnerId, ownerType]);
  const { t, lang } = useI18n();
  const [kids, setKids] = useState([]);
  const [activeKid, setActiveKid] = useState(null);
  const [tab, setTab] = useState('overview');

  const [showKidForm, setShowKidForm] = useState(false);
  const [editingKid, setEditingKid] = useState(null);

  // per-kid data
  const [milestones, setMilestones] = useState([]);
  const [logs, setLogs] = useState([]);
  const [curr, setCurr] = useState([]);

  const [showMsForm, setShowMsForm] = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [showCurrForm, setShowCurrForm] = useState(false);

  // subscribe kids list
  useEffect(() => {
    if (!owner || !appId) return;
    const unsub = subscribeKids(owner, appId, list => {
      setKids(list);
      if (list.length > 0 && !activeKid) setActiveKid(list[0].id);
      if (activeKid && !list.find(k => k.id === activeKid)) setActiveKid(list[0]?.id || null);
    });
    return () => unsub && unsub();
  }, [owner, appId]); // eslint-disable-line

  // subscribe per-kid collections
  useEffect(() => {
    if (!activeKid || !owner || !appId) {
      setMilestones([]); setLogs([]); setCurr([]);
      return;
    }
    const u1 = subscribeMilestones(owner, appId, activeKid, setMilestones);
    const u2 = subscribeLogs(owner, appId, activeKid, setLogs);
    const u3 = subscribeCurriculum(owner, appId, activeKid, setCurr);
    return () => { u1 && u1(); u2 && u2(); u3 && u3(); };
  }, [activeKid, owner, appId]);

  const kid = useMemo(() => kids.find(k => k.id === activeKid) || null, [kids, activeKid]);
  const age = kid ? calcAge(kid.dob) : null;
  const totalMonths = age?.totalMonths ?? 0;

  const msPresets = useMemo(() => getMilestonePresetsForAge(totalMonths), [totalMonths]);
  const currPresets = useMemo(() => PRESET_CURRICULUM[pickPresetBucket(totalMonths)] || [], [totalMonths]);
  const completedCurr = curr.filter(c => c.completed).length;

  // ── handlers ──
  const handleSaveKid = async (payload) => {
    if (editingKid) {
      await updateKid(owner, appId, editingKid.id, payload);
    } else {
      const id = await createKid(owner, appId, payload);
      setActiveKid(id);
    }
    setShowKidForm(false); setEditingKid(null);
  };
  const handleDeleteKid = async () => {
    if (!kid) return;
    if (!window.confirm(t('kids.deleteKid'))) return;
    await deleteKid(owner, appId, kid.id);
    setActiveKid(null);
  };

  if (!owner || !appId) {
    return <div className="p-8 text-center text-gray-400">—</div>;
  }

  // Empty state
  if (kids.length === 0) {
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto">
        <div className="flex flex-col items-center justify-center text-center py-20 bg-gradient-to-br from-pink-50 to-emerald-50 dark:from-gray-800 dark:to-gray-800 rounded-3xl border-2 border-dashed border-pink-200 dark:border-gray-700">
          <Icon name="family_restroom" size={80} className="text-pink-300 dark:text-pink-700 mb-4" />
          <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">{t('kids.title')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md">{t('kids.subtitle')}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('kids.noKids')}</p>
          <button onClick={() => { setEditingKid(null); setShowKidForm(true); }}
            className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 flex items-center gap-2">
            <Icon name="add_circle" fill={1} />
            {t('kids.addKid')}
          </button>
        </div>
        <KidFormModal open={showKidForm} onClose={() => setShowKidForm(false)} onSave={handleSaveKid} initial={editingKid} />
      </div>
    );
  }

  const tabClass = (k) => `flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
    tab === k
      ? 'bg-primary text-on-primary shadow'
      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
  }`;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* ── Kid selector ── */}
      <div className="flex flex-wrap items-center gap-2">
        {kids.map(k => {
          const a = calcAge(k.dob);
          const active = k.id === activeKid;
          return (
            <button key={k.id} onClick={() => setActiveKid(k.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                active
                  ? 'bg-primary text-on-primary border-primary shadow-md'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-pink-300'
              }`}>
              {k.gender === 'M' ? '👦' : '👧'} {k.name} <span className="opacity-75 text-xs">({formatAge(k.dob)})</span>
            </button>
          );
        })}
        <button onClick={() => { setEditingKid(null); setShowKidForm(true); }}
          className="px-3 py-2 rounded-xl text-sm border-2 border-dashed border-pink-300 dark:border-pink-700 text-pink-600 dark:text-pink-300 hover:bg-pink-50 dark:hover:bg-pink-900/30 flex items-center gap-1">
          <Icon name="add" size={16} />
          {t('kids.addKid')}
        </button>
      </div>

      {/* ── Header card ── */}
      {kid && (
        <div className="rounded-2xl bg-gradient-to-br from-pink-50 to-emerald-50 dark:from-gray-800 dark:to-gray-800 border border-pink-100 dark:border-gray-700 p-5 flex items-start gap-4">
          <div className="text-5xl">{kid.gender === 'M' ? '👦' : '👧'}</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{kid.name}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('kids.ageLabel')}: <strong className="text-primary">{formatAge(kid.dob)}</strong>
              {age && <span className="text-xs text-gray-400 ml-2">({age.birthDate.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US')})</span>}
            </p>
            {kid.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{kid.notes}</p>}
          </div>
          <div className="flex gap-1">
            <button onClick={() => { setEditingKid(kid); setShowKidForm(true); }}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-700" title="Edit">
              <Icon name="edit" size={18} />
            </button>
            <button onClick={handleDeleteKid}
              className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30" title="Hapus">
              <Icon name="delete" size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
        {TABS.map(k => (
          <button key={k} onClick={() => setTab(k)} className={tabClass(k)}>
            {t(`kids.tabs.${k}`)}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tab === 'overview' && kid && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label={t('kids.tabs.milestones')} value={milestones.length} icon="emoji_events" color="text-amber-500" />
          <StatCard label={t('kids.tabs.logs')}       value={logs.length}       icon="edit_note"     color="text-blue-500" />
          <StatCard
            label={t('kids.curriculum.progress')}
            value={`${completedCurr}/${curr.length}`}
            icon="checklist"
            color="text-emerald-600"
            sub={curr.length > 0 ? `${Math.round((completedCurr / curr.length) * 100)}%` : ''}
          />
        </div>
      )}

      {tab === 'milestones' && kid && (
        <Section
          title={t('kids.milestone.title')}
          onAdd={() => setShowMsForm(true)}
          addLabel={t('kids.milestone.addTitle')}
          empty={t('kids.milestone.empty')}
          isEmpty={milestones.length === 0}
        >
          <div className="space-y-2">
            {milestones.map(m => (
              <div key={m.id} className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <span className="text-2xl">{categoryEmoji(m.category)}</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 dark:text-gray-100">{m.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {categoryLabel(m.category, t)} · {m.achievedAt}
                  </p>
                  {m.notes && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{m.notes}</p>}
                </div>
                <button onClick={() => deleteMilestone(owner, appId, kid.id, m.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded">
                  <Icon name="delete" size={16} />
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === 'logs' && kid && (
        <Section
          title={t('kids.log.title')}
          onAdd={() => setShowLogForm(true)}
          addLabel={t('kids.log.addLog')}
          empty={t('kids.log.empty')}
          isEmpty={logs.length === 0}
        >
          <div className="space-y-2">
            {logs.map(l => (
              <div key={l.id} className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-3">
                  <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5 w-20 shrink-0">{l.date}</div>
                  <div className="flex-1">
                    {l.mood && <p className="text-sm text-gray-700 dark:text-gray-200">{l.mood}</p>}
                    {(l.weightKg || l.heightCm) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {l.weightKg ? `${l.weightKg} kg` : ''}{l.weightKg && l.heightCm ? ' · ' : ''}{l.heightCm ? `${l.heightCm} cm` : ''}
                      </p>
                    )}
                    {l.note && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{l.note}</p>}
                  </div>
                  <button onClick={() => deleteLog(owner, appId, kid.id, l.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded">
                    <Icon name="delete" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab === 'curriculum' && kid && (
        <div className="space-y-4">
          {/* Progress bar */}
          {curr.length > 0 && (
            <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {t('kids.curriculum.progress')}
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {completedCurr} {t('kids.curriculum.ofCompleted')} {curr.length} ({Math.round((completedCurr / curr.length) * 100)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-pink-400 to-emerald-500 transition-all"
                  style={{ width: `${(completedCurr / curr.length) * 100}%` }} />
              </div>
            </div>
          )}

          <Section
            title={t('kids.curriculum.title')}
            onAdd={() => setShowCurrForm(true)}
            addLabel={t('kids.curriculum.addSubject')}
            empty={t('kids.curriculum.empty')}
            isEmpty={curr.length === 0}
          >
            <div className="space-y-2">
              {curr.map(c => (
                <div key={c.id} className={`p-3 rounded-xl border-2 flex items-start gap-3 ${
                  c.completed
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  <button onClick={() => toggleCurriculumItem(owner, appId, kid.id, c.id, !c.completed)}
                    className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                      c.completed
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 hover:border-pink-400'
                    }`}>
                    {c.completed && <Icon name="check" size={16} fill={1} />}
                  </button>
                  <div className="flex-1">
                    <p className={`font-semibold ${c.completed ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-800 dark:text-gray-100'}`}>
                      {c.subject}
                    </p>
                    {c.goal && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">🎯 {c.goal}</p>}
                    {c.schedule && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">📅 {c.schedule}</p>}
                    {c.notes && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{c.notes}</p>}
                  </div>
                  <button onClick={() => {
                    if (window.confirm(t('kids.curriculum.deleteConfirm')))
                      deleteCurriculumItem(owner, appId, kid.id, c.id);
                  }} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded">
                    <Icon name="delete" size={16} />
                  </button>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Modals */}
      <KidFormModal open={showKidForm} onClose={() => { setShowKidForm(false); setEditingKid(null); }} onSave={handleSaveKid} initial={editingKid} />
      <MilestoneModal open={showMsForm} onClose={() => setShowMsForm(false)}
        onSave={p => addMilestone(owner, appId, kid.id, p).then(() => setShowMsForm(false))}
        presets={msPresets} />
      <LogModal open={showLogForm} onClose={() => setShowLogForm(false)}
        onSave={p => addLog(owner, appId, kid.id, p).then(() => setShowLogForm(false))} />
      <CurriculumModal open={showCurrForm} onClose={() => setShowCurrForm(false)}
        onSave={p => addCurriculumItem(owner, appId, kid.id, p).then(() => setShowCurrForm(false))}
        presets={currPresets} />
    </div>
  );
}

function StatCard({ label, value, icon, color, sub }) {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{label}</span>
        <Icon name={icon} size={20} className={color} />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, onAdd, addLabel, children, empty, isEmpty }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white/50 dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
        <button onClick={onAdd}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:opacity-90 flex items-center gap-1">
          <Icon name="add" size={14} />
          {addLabel}
        </button>
      </div>
      {isEmpty ? (
        <p className="text-sm text-gray-400 italic text-center py-6">{empty}</p>
      ) : children}
    </div>
  );
}

function categoryEmoji(cat) {
  return ({
    motorik:  '🏃',
    bahasa:   '💬',
    sosial:   '🤝',
    kognitif: '🧠',
    lainnya:  '✨',
  })[cat] || '✨';
}
function categoryLabel(cat, t) {
  return t(`kids.milestone.cat${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
}
