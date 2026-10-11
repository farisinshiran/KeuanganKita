import React, { useState, useCallback } from 'react';
import { Wallet, Users, ShieldCheck, LogIn, ChevronRight, AlertCircle, Loader2, User, UserCheck, Baby } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { IS_DEMO_MODE } from '../../config/firebase';
import { ROLES } from '../../services/personalAuth';
import { getDemoAccounts } from '../../lib/seedData';

/**
 * RoleSelectionPage
 * First screen shown to unauthenticated users (after they choose "Personal" mode).
 * Lets them pick a role (Ayah / Ibu / Anak) and sign in or sign up.
 *
 * Flow:
 *  1. User selects role (Ayah / Ibu / Anak)
 *  2. User chooses Sign In (existing) or Sign Up (new account)
 *  3. Form: name + PIN (+ dob for Anak on sign up)
 *  4. Calls personalAuth.signIn() or signUp()
 *  5. Calls onPersonalLogin(result) on success
 */
export default function RoleSelectionPage({ onPersonalLogin, onBack, isLoading }) {
  const { t, lang, setLang } = useI18n();
  const [step, setStep]             = useState('role'); // 'role' | 'auth'
  const [role, setRole]             = useState(null);   // ROLES.AYAH | IBU | ANAK
  const [mode, setMode]             = useState('signin'); // 'signin' | 'signup'
  const [name, setName]             = useState('');
  const [pin, setPin]               = useState('');
  const [dob, setDob]               = useState('');
  const [showPin, setShowPin]       = useState(false);
  const [formError, setFormError]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handlePinInput = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(val);
  };

  const selectRole = (r) => {
    setRole(r);
    setStep('auth');
    setFormError('');
  };

  const handleDemoLogin = async (demo) => {
    setFormError('');
    if (IS_DEMO_MODE) return setFormError(t('auth.errorDemo'));
    setSubmitting(true);
    try {
      const { signIn, signInDemo } = await import('../../services/personalAuth');
      // Try signIn first (if account already exists), fallback to signInDemo which also tries signIn
      let result;
      try {
        result = await signIn({ name: demo.name, role: demo.role, pin: demo.pin });
      } catch (e) {
        // If not found, sign up automatically
        if (e.message.includes('belum terdaftar') || e.message.includes('not registered')) {
          result = await signInDemo(demo.role);
        } else {
          throw e;
        }
      }
      onPersonalLogin(result);
    } catch (err) {
      setFormError(err.message || t('auth.errorGeneral'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (IS_DEMO_MODE) return setFormError(t('auth.errorDemo'));

    if (!name.trim()) return setFormError(t('auth.errorMemberName'));
    if (pin.length !== 6) return setFormError(t('auth.errorPinLength6'));

    if (mode === 'signup' && role === ROLES.ANAK && !dob) {
      return setFormError(t('auth.errorAnakDob'));
    }

    setSubmitting(true);
    try {
      const { signIn, signUp } = await import('../../services/personalAuth');
      let result;
      if (mode === 'signin') {
        result = await signIn({ name: name.trim(), role, pin });
      } else {
        result = await signUp({
          name: name.trim(),
          role,
          pin,
          dob: role === ROLES.ANAK ? new Date(dob) : null,
        });
      }
      onPersonalLogin(result);
    } catch (err) {
      setFormError(err.message || t('auth.errorGeneral'));
    } finally {
      setSubmitting(false);
    }
  };

  const roleConfig = {
    [ROLES.AYAH]: { icon: User,     color: 'blue',  label: t('auth.roleAyah'), desc: t('auth.roleAyahDesc') },
    [ROLES.IBU]:  { icon: UserCheck, color: 'pink', label: t('auth.roleIbu'),  desc: t('auth.roleIbuDesc')  },
    [ROLES.ANAK]: { icon: Baby,     color: 'green', label: t('auth.roleAnak'), desc: t('auth.roleAnakDesc') },
  };

  const canSubmit = () => {
    if (submitting) return false;
    if (!name.trim()) return false;
    if (pin.length !== 6) return false;
    if (mode === 'signup' && role === ROLES.ANAK && !dob) return false;
    return true;
  };

  const demoAccounts = getDemoAccounts();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
      <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-lg max-w-md w-full text-center border dark:border-gray-700">
        {/* Language switcher */}
        <div className="flex items-center justify-end gap-2 mb-4">
          <button onClick={() => setLang('id')} className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${lang === 'id' ? 'bg-pink-400 text-white border-pink-400' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}>{t('common.indonesian')}</button>
          <button onClick={() => setLang('en')} className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${lang === 'en' ? 'bg-pink-400 text-white border-pink-400' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}>{t('common.english')}</button>
        </div>

        {/* Header */}
        <div className="bg-pink-100 dark:bg-pink-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-8 h-8 text-pink-400 dark:text-pink-300" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">{t('common.appName')}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{t('auth.personalSubtitle')}</p>

        {/* Step: Role Selection */}
        {step === 'role' && (
          <>
            <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-4 text-left">
              {t('auth.chooseRole')}
            </h2>
            <div className="space-y-3">
              {[ROLES.AYAH, ROLES.IBU, ROLES.ANAK].map((r) => {
                const cfg = roleConfig[r];
                const Icon = cfg.icon;
                return (
                  <button
                    key={r}
                    onClick={() => selectRole(r)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 border-${cfg.color}-200 dark:border-${cfg.color}-700 bg-${cfg.color}-50 dark:bg-${cfg.color}-900/20 hover:bg-${cfg.color}-100 dark:hover:bg-${cfg.color}-900/40 transition-colors text-left`}
                  >
                    <div className={`bg-${cfg.color}-200 dark:bg-${cfg.color}-800 p-2 rounded-lg`}>
                      <Icon size={24} className={`text-${cfg.color}-600 dark:text-${cfg.color}-300`} />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800 dark:text-white">{cfg.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{cfg.desc}</div>
                    </div>
                    <ChevronRight size={20} className="text-gray-400" />
                  </button>
                );
              })}
            </div>

            {/* Demo accounts (only in non-prod / no firebase) */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-left">{t('auth.demoAccounts')}</p>
              <div className="grid grid-cols-2 gap-2">
                {demoAccounts.map((d) => (
                  <button
                    key={`${d.role}-${d.name}`}
                    type="button"
                    onClick={() => handleDemoLogin(d)}
                    disabled={submitting}
                    className="text-xs px-2 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-60"
                  >
                    {d.role === ROLES.AYAH ? '👨' : d.role === ROLES.IBU ? '👩' : '🧒'} {d.name}
                  </button>
                ))}
              </div>
            </div>

            {onBack && (
              <button
                onClick={onBack}
                className="mt-4 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center justify-center gap-1 mx-auto"
              >
                ← {t('auth.backToLogin')}
              </button>
            )}
          </>
        )}

        {/* Step: Sign In / Sign Up Form */}
        {step === 'auth' && role && (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Role badge */}
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => { setStep('role'); setFormError(''); }}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700"
              >
                ← {t('common.back')}
              </button>
              <span className={`text-xs px-2 py-1 rounded-full bg-${roleConfig[role].color}-100 dark:bg-${roleConfig[role].color}-900/30 text-${roleConfig[role].color}-700 dark:text-${roleConfig[role].color}-300`}>
                {roleConfig[role].label}
              </span>
            </div>

            {/* Mode toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
              <button
                type="button"
                onClick={() => { setMode('signin'); setFormError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'signin' ? 'bg-white dark:bg-gray-600 text-pink-500 shadow-sm' : 'text-gray-500 dark:text-gray-300'
                }`}
              >
                {t('auth.modeLogin')}
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setFormError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'signup' ? 'bg-white dark:bg-gray-600 text-pink-500 shadow-sm' : 'text-gray-500 dark:text-gray-300'
                }`}
              >
                {t('auth.modeSignUp')}
              </button>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                <Users size={12} className="inline mr-1" />
                {t('auth.yourName')}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('auth.yourNamePlaceholder')}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
                autoComplete="off"
                autoCapitalize="off"
                maxLength={40}
              />
            </div>

            {/* DOB (Anak only, signup only) */}
            {mode === 'signup' && role === ROLES.ANAK && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  {t('auth.dateOfBirth')}
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
                />
              </div>
            )}

            {/* PIN */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                <ShieldCheck size={12} className="inline mr-1" />
                {t('auth.pin')} (6 {t('auth.digits')})
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  value={pin}
                  onChange={handlePinInput}
                  placeholder="••••••"
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl py-2.5 px-3.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
                  autoComplete="off"
                  maxLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPin ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {formError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-lg p-2.5 flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span className="text-left">{formError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit()}
              className="w-full bg-pink-400 hover:bg-pink-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              {submitting
                ? <Loader2 size={20} className="animate-spin" />
                : <LogIn size={20} />
              }
              {mode === 'signin' ? t('auth.loginButton') : t('auth.signUpButton')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
