import React, { useState, useCallback } from 'react';
import { Wallet, LogIn, Users, Lock, Eye, EyeOff, ChevronRight, ArrowLeft, CheckCircle, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

export default function LoginPage({ onLogin, onHouseholdLogin, isLoading }) {
  const { t, lang, setLang } = useI18n();
  const [activeTab, setActiveTab] = useState('google'); // 'google' | 'pin'

  // ── PIN/Password form state ──────────────────────────────
  const [mode, setMode]           = useState('join');   // 'create' | 'join'
  const [householdName, setHouseholdName] = useState('');
  const [memberName, setMemberName]       = useState('');
  const [pin, setPin]                     = useState('');
  const [password, setPassword]         = useState('');
  const [showPin, setShowPin]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [usePassword, setUsePassword]   = useState(false);
  const [formError, setFormError]       = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [nameAvailable, setNameAvailable] = useState(null); // null | true | false

  const checkName = useCallback(async () => {
    if (!householdName.trim() || householdName.length < 3) return;
    const { isHouseholdNameAvailable } = await import('../../services/householdAuth');
    const available = await isHouseholdNameAvailable(householdName.trim());
    setNameAvailable(available);
  }, [householdName]);

  const handlePinInput = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(val);
  };

  const handlePasswordInput = (e) => {
    setPassword(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!householdName.trim()) return setFormError(t('auth.errorHouseholdName'));
    if (!memberName.trim())    return setFormError(t('auth.errorMemberName'));

    if (usePassword) {
      if (password.length < 4) return setFormError(t('auth.errorPasswordLength'));
    } else {
      if (pin.length < 4) return setFormError(t('auth.errorPinLength'));
    }

    setSubmitting(true);
    try {
      const { createHousehold, joinHousehold } = await import('../../services/householdAuth');
      if (mode === 'create') {
        if (!nameAvailable) return setFormError(t('auth.errorNameTaken'));
        await createHousehold({
          householdName,
          memberName,
          pin: usePassword ? null : pin,
          password: usePassword ? password : null,
        });
      } else {
        await joinHousehold({
          householdName,
          memberName,
          pin: usePassword ? null : pin,
          password: usePassword ? password : null,
        });
      }
      onHouseholdLogin({ householdName: householdName.trim(), memberName: memberName.trim() });
    } catch (err) {
      setFormError(err.message || t('auth.errorGeneral'));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = () => {
    if (submitting) return false;
    if (!householdName.trim() || !memberName.trim()) return false;
    if (usePassword) return password.length >= 4;
    return pin.length >= 4;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
      <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-lg max-w-md w-full text-center border dark:border-gray-700">
        {/* Language switcher */}
        <div className="flex items-center justify-end gap-2 mb-4">
          <button onClick={() => setLang('id')} className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${lang === 'id' ? 'bg-pink-400 text-white border-pink-400' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}>{t('common.indonesian')}</button>
          <button onClick={() => setLang('en')} className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${lang === 'en' ? 'bg-pink-400 text-white border-pink-400' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}>{t('common.english')}</button>
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
            onClick={() => setActiveTab('google')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'google'
                ? 'bg-white dark:bg-gray-600 text-pink-500 shadow-sm'
                : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
            }`}
          >
            <LogIn size={16} />
            {t('auth.tabGoogle')}
          </button>
          <button
            onClick={() => setActiveTab('pin')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'pin'
                ? 'bg-white dark:bg-gray-600 text-pink-500 shadow-sm'
                : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
            }`}
          >
            <ShieldCheck size={16} />
            {t('auth.tabPinPassword')}
          </button>
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

        {/* ── PIN / Password Tab ─────────────────────────── */}
        {activeTab === 'pin' && (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Mode Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
              <button
                type="button"
                onClick={() => { setMode('join'); setFormError(''); setNameAvailable(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'join' ? 'bg-white dark:bg-gray-600 text-pink-500 shadow-sm' : 'text-gray-500 dark:text-gray-300'
                }`}
              >
                {t('auth.modeJoin')}
              </button>
              <button
                type="button"
                onClick={() => { setMode('create'); setFormError(''); setNameAvailable(null); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'create' ? 'bg-white dark:bg-gray-600 text-pink-500 shadow-sm' : 'text-gray-500 dark:text-gray-300'
                }`}
              >
                {t('auth.modeCreate')}
              </button>
            </div>

            {/* Household Name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                <Users size={12} className="inline mr-1" />
                {t('auth.householdName')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={householdName}
                  onChange={e => { setHouseholdName(e.target.value); setNameAvailable(null); }}
                  onBlur={mode === 'create' ? checkName : undefined}
                  placeholder={t('auth.householdNamePlaceholder')}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl py-2.5 px-3.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
                  autoComplete="off"
                  autoCapitalize="off"
                />
                {mode === 'create' && nameAvailable !== null && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {nameAvailable
                      ? <CheckCircle size={16} className="text-green-500" />
                      : <AlertCircle size={16} className="text-red-500" />
                    }
                  </span>
                )}
              </div>
              {mode === 'create' && nameAvailable === true && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">{t('auth.nameAvailable')}</p>
              )}
              {mode === 'create' && nameAvailable === false && (
                <p className="text-xs text-red-500 mt-1">{t('auth.nameTaken')}</p>
              )}
            </div>

            {/* Member Name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                <Lock size={12} className="inline mr-1" />
                {t('auth.memberName')}
              </label>
              <input
                type="text"
                value={memberName}
                onChange={e => setMemberName(e.target.value)}
                placeholder={t('auth.memberNamePlaceholder')}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
              />
            </div>

            {/* PIN vs Password Toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                {t('auth.loginMethod')}
              </label>
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => { setUsePassword(false); setPassword(''); }}
                  className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                    !usePassword ? 'bg-white dark:bg-gray-600 text-pink-500 shadow-sm' : 'text-gray-500 dark:text-gray-300'
                  }`}
                >
                  {t('auth.usePin')}
                </button>
                <button
                  type="button"
                  onClick={() => { setUsePassword(true); setPin(''); }}
                  className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                    usePassword ? 'bg-white dark:bg-gray-600 text-pink-500 shadow-sm' : 'text-gray-500 dark:text-gray-300'
                  }`}
                >
                  {t('auth.usePassword')}
                </button>
              </div>
            </div>

            {/* PIN Input */}
            {!usePassword && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  {t('auth.pin')} <span className="text-pink-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={handlePinInput}
                    placeholder={t('auth.pinPlaceholder')}
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
                <p className="text-xs text-gray-400 mt-1">{t('auth.pinHint')}</p>
              </div>
            )}

            {/* Password Input */}
            {usePassword && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  {t('auth.password')} <span className="text-pink-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordInput}
                    placeholder={t('auth.passwordPlaceholder')}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl py-2.5 px-3.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">{t('auth.passwordHint')}</p>
              </div>
            )}

            {/* Error Message */}
            {formError && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!canSubmit()}
              className="w-full bg-pink-400 hover:bg-pink-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? <Loader2 size={18} className="animate-spin" />
                : mode === 'create'
                  ? <><CheckCircle size={18} /> {t('auth.btnCreateHousehold')}</>
                  : <><ChevronRight size={18} /> {t('auth.btnJoinHousehold')}</>
              }
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
