import React, { useState } from 'react';
import {
  Wallet, LogIn, Lock, Eye, EyeOff,
  ArrowLeft, CheckCircle, AlertCircle,
  Loader2, ShieldCheck, User, Baby,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { IS_DEMO_MODE } from '../../config/firebase';
import { ROLES, ROLE_LABELS } from '../../services/familyAuth';

// ── Role option buttons ──────────────────────────────────────
const RoleOption = ({ role, selected, onClick }) => {
  const labels = ROLE_LABELS.id;
  const icons  = { ayah: '👨', ibu: '👩', anak: '👦' };
  const colors = {
    ayah:  'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30',
    ibu:   'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-700 text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/30',
    anak:  'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30',
  };
  const selColors = {
    ayah:  'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-500 ring-2 ring-blue-400',
    ibu:   'bg-pink-100 dark:bg-pink-900/40 border-pink-400 dark:border-pink-500 ring-2 ring-pink-400',
    anak:  'bg-amber-100 dark:bg-amber-900/40 border-amber-400 dark:border-amber-500 ring-2 ring-amber-400',
  };
  return (
    <button
      type="button"
      onClick={() => onClick(role)}
      className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all text-sm font-semibold
        ${selected ? selColors[role] : colors[role]}`}
    >
      <span className="text-2xl">{icons[role]}</span>
      <span>{labels[role]}</span>
    </button>
  );
};

// ── Demo PIN hints ────────────────────────────────────────────
const DEMO_HINTS = [
  { role: 'ayah', name: 'Faris',  pin: '111111' },
  { role: 'ibu',  name: 'Aisyah', pin: '222222' },
  { role: 'anak', name: 'Naura',  pin: '333333' },
  { role: 'anak', name: 'Haffi',  pin: '444444' },
];

export default function LoginPage({ onLogin, onFamilyLogin, isLoading }) {
  const { t, lang, setLang } = useI18n();
  const [activeTab, setActiveTab] = useState('google'); // 'google' | 'pin'

  // ── PIN form state ────────────────────────────────────────
  const [step, setStep]               = useState(1);   // 1=select role, 2=name+pin
  const [selectedRole, setSelectedRole] = useState(null);
  const [memberName, setMemberName]   = useState('');
  const [pin, setPin]                 = useState('');
  const [showPin, setShowPin]         = useState(false);
  const [formError, setFormError]     = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const handlePinInput = (e) => {
    setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setMemberName('');
    setPin('');
    setFormError('');
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setSelectedRole(null);
    setMemberName('');
    setPin('');
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (IS_DEMO_MODE) return setFormError(t('auth.errorDemo'));

    if (!memberName.trim()) return setFormError(t('auth.errorMemberName'));
    if (pin.length !== 6)  return setFormError(t('auth.errorPinLength6'));

    setSubmitting(true);
    try {
      const { signInWithPin } = await import('../../services/familyAuth');
      const result = await signInWithPin({ name: memberName.trim(), role: selectedRole, pin });
      onFamilyLogin(result);
    } catch (err) {
      setFormError(err.message || t('auth.errorGeneral'));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = () =>
    !submitting && memberName.trim().length > 0 && pin.length === 6;

  const labels = ROLE_LABELS.id;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
      <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-lg max-w-md w-full text-center border dark:border-gray-700">

        {/* Language switcher */}
        <div className="flex items-center justify-end gap-2 mb-4">
          <button
            onClick={() => setLang('id')}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${lang === 'id' ? 'bg-pink-400 text-white border-pink-400' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
          >{t('common.indonesian')}</button>
          <button
            onClick={() => setLang('en')}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${lang === 'en' ? 'bg-pink-400 text-white border-pink-400' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
          >{t('common.english')}</button>
        </div>

        {/* Logo & Title */}
        <div className="bg-pink-100 dark:bg-pink-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-8 h-8 text-pink-400 dark:text-pink-300" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">{t('common.appName')}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{t('auth.subtitle')}</p>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setActiveTab('google'); handleBack(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'google'
                ? 'bg-white dark:bg-gray-600 text-pink-500 shadow-sm'
                : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
            }`}
          >
            <LogIn size={16} />
            {t('auth.tabGoogle')}
          </button>
          {!IS_DEMO_MODE && (
            <button
              onClick={() => { setActiveTab('pin'); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'pin'
                  ? 'bg-white dark:bg-gray-600 text-pink-500 shadow-sm'
                  : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              <ShieldCheck size={16} />
              {t('auth.tabPin')}
            </button>
          )}
        </div>

        {/* ── Google Tab ─────────────────────────────────── */}
        {activeTab === 'google' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('auth.googleDesc')}</p>
            <button
              onClick={onLogin}
              disabled={isLoading}
              className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white font-semibold py-3 px-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center gap-3 transition-colors disabled:opacity-60"
            >
              {isLoading
                ? <Loader2 size={20} className="animate-spin text-pink-400" />
                : <LogIn size={20} className="text-pink-400" />
              }
              {t('auth.loginGoogle')}
            </button>
          </div>
        )}

        {/* ── PIN Tab ────────────────────────────────────── */}
        {activeTab === 'pin' && (
          <div className="space-y-4 text-left">

            {/* Step 1: Pilih Peran */}
            {step === 1 && (
              <>
                <div className="text-center mb-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('auth.selectRoleTitle')}</p>
                  <p className="text-xs text-gray-400">{t('auth.selectRoleHint')}</p>
                </div>
                <div className="flex gap-2">
                  <RoleOption role={ROLES.AYAH} selected={selectedRole === ROLES.AYAH} onClick={handleRoleSelect} />
                  <RoleOption role={ROLES.IBU}  selected={selectedRole === ROLES.IBU}  onClick={handleRoleSelect} />
                  <RoleOption role={ROLES.ANAK} selected={selectedRole === ROLES.ANAK} onClick={handleRoleSelect} />
                </div>

                {/* Demo hint */}
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-2">🔑 Akun Demo</p>
                  <div className="space-y-1">
                    {DEMO_HINTS.map((h) => (
                      <p key={`${h.role}-${h.name}`} className="text-xs text-amber-600 dark:text-amber-400">
                        {labels[h.role]} <strong>{h.name}</strong> → PIN <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">{h.pin}</code>
                      </p>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Nama + PIN */}
            {step === 2 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Back + role badge */}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleBack} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <ArrowLeft size={18} />
                  </button>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
                    <span className="text-lg">
                      {selectedRole === 'ayah' ? '👨' : selectedRole === 'ibu' ? '👩' : '👦'}
                    </span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {labels[selectedRole]}
                    </span>
                  </div>
                </div>

                {/* Nama */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    <User size={12} className="inline mr-1" />
                    {t('auth.yourName')}
                  </label>
                  <input
                    type="text"
                    value={memberName}
                    onChange={e => setMemberName(e.target.value)}
                    placeholder={t('auth.namePlaceholder')}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
                    autoComplete="off"
                    autoCapitalize="words"
                  />
                </div>

                {/* PIN */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    <Lock size={12} className="inline mr-1" />
                    {t('auth.pin6')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      value={pin}
                      onChange={handlePinInput}
                      placeholder={t('auth.pinPlaceholder6')}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl py-2.5 px-3.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent tracking-widest text-center font-mono"
                      maxLength={6}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{t('auth.pinHint6')}</p>
                </div>

                {/* Error */}
                {formError && (
                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                    <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!canSubmit()}
                  className="w-full bg-pink-400 hover:bg-pink-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? <Loader2 size={18} className="animate-spin" />
                    : <><CheckCircle size={18} /> {t('auth.btnLogin')}</>
                  }
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
