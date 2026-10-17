import React, { useState } from 'react';
import {
  Wallet, LogIn, Mail, Lock, Eye, EyeOff,
  CheckCircle, AlertCircle, Loader2, ShieldCheck,
} from 'lucide-react';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth, IS_DEMO_MODE } from '../../config/firebase';
import { useI18n } from '../../i18n/I18nContext';

function getAuthErrorMessage(error, t) {
  const messages = {
    'auth/email-already-in-use': 'errorEmailInUse',
    'auth/credential-already-in-use': 'errorEmailInUse',
    'auth/invalid-email': 'errorInvalidEmail',
    'auth/invalid-credential': 'errorInvalidCredentials',
    'auth/user-not-found': 'errorInvalidCredentials',
    'auth/wrong-password': 'errorInvalidCredentials',
    'auth/weak-password': 'errorWeakPassword',
    'auth/too-many-requests': 'errorTooManyRequests',
    'auth/operation-not-allowed': 'errorEmailProviderDisabled',
    'auth/network-request-failed': 'errorNetwork',
  };
  const key = messages[error.code];
  return key ? t(`auth.${key}`) : error.message || t('auth.errorGeneral');
}

export default function LoginPage({ onLogin, isLoading }) {
  const { t, lang, setLang } = useI18n();
  const [activeTab, setActiveTab] = useState(IS_DEMO_MODE ? 'google' : 'email');
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetMessages = () => {
    setFormError('');
    setNotice('');
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    resetMessages();
    setPassword('');
    setConfirmPassword('');
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    resetMessages();
    const normalizedEmail = email.trim();

    if (mode === 'signup' && password !== confirmPassword) {
      setFormError(t('auth.errorPasswordMismatch'));
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setFormError(t('auth.errorWeakPassword'));
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const credential = EmailAuthProvider.credential(normalizedEmail, password);
        if (auth.currentUser?.isAnonymous) {
          await linkWithCredential(auth.currentUser, credential);
        } else {
          await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        }
      } else {
        await signInWithEmailAndPassword(auth, normalizedEmail, password);
      }
    } catch (error) {
      setFormError(getAuthErrorMessage(error, t));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    resetMessages();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setFormError(t('auth.errorEmailRequiredForReset'));
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setNotice(t('auth.passwordResetSent'));
    } catch (error) {
      setFormError(getAuthErrorMessage(error, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
      <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-lg max-w-md w-full text-center border dark:border-gray-700">
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

        <div className="bg-pink-100 dark:bg-pink-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-8 h-8 text-pink-400 dark:text-pink-300" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">{t('common.appName')}</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{t('auth.subtitle')}</p>

        {!IS_DEMO_MODE && (
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => { setActiveTab('email'); resetMessages(); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'email'
                  ? 'bg-white dark:bg-gray-600 text-pink-500 shadow-sm'
                  : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              <Mail size={16} />
              {t('auth.tabEmail')}
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('google'); resetMessages(); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'google'
                  ? 'bg-white dark:bg-gray-600 text-pink-500 shadow-sm'
                  : 'text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              <LogIn size={16} />
              {t('auth.tabGoogle')}
            </button>
          </div>
        )}

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

        {activeTab === 'email' && (
          <div className="space-y-4 text-left">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              {mode === 'signup' ? t('auth.emailSignupDesc') : t('auth.emailSigninDesc')}
            </p>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  <Mail size={12} className="inline mr-1" />
                  {t('auth.email')}
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  required
                  autoComplete="email"
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  <Lock size={12} className="inline mr-1" />
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    required
                    minLength={mode === 'signup' ? 6 : undefined}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl py-2.5 px-3.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(value => !value)}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label htmlFor="confirm-password" className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    <ShieldCheck size={12} className="inline mr-1" />
                    {t('auth.confirmPassword')}
                  </label>
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={event => setConfirmPassword(event.target.value)}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    required
                    autoComplete="new-password"
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
                  />
                </div>
              )}

              {formError && (
                <div role="alert" className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>
                </div>
              )}
              {notice && (
                <div role="status" className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
                  <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                  <p className="text-xs text-green-700 dark:text-green-400">{notice}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !email.trim() || !password}
                className="w-full bg-pink-400 hover:bg-pink-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? <Loader2 size={18} className="animate-spin" />
                  : <><CheckCircle size={18} /> {mode === 'signup' ? t('auth.btnCreateAccount') : t('auth.btnLogin')}</>
                }
              </button>
            </form>

            <div className="flex flex-col items-center gap-2 text-xs">
              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={submitting}
                  className="text-pink-500 hover:text-pink-600 font-medium disabled:opacity-50"
                >
                  {t('auth.forgotPassword')}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleModeChange(mode === 'signin' ? 'signup' : 'signin')}
                className="text-gray-500 dark:text-gray-400 hover:text-pink-500"
              >
                {mode === 'signin' ? t('auth.switchToSignup') : t('auth.switchToSignin')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
