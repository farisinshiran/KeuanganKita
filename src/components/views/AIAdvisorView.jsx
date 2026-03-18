import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Settings, X, Sparkles, RefreshCw, Key, ChevronDown } from 'lucide-react';
import { calculateHealthScore } from '../../utils/healthScore';

// ── LocalStorage keys ──────────────────────────────────────────────────────
const LS_PROVIDER   = 'ai_advisor_provider';
const LS_GEMINI_KEY = 'ai_advisor_gemini_key';
const LS_OR_KEY     = 'ai_advisor_openrouter_key';
const LS_OR_MODEL   = 'ai_advisor_openrouter_model';

// ── OpenRouter model options ───────────────────────────────────────────────
const OR_MODELS = [
  // ── Google ────────────────────────────────────────────────────────────────
  { value: 'google/gemini-2.0-flash',                         label: 'Gemini 2.0 Flash' },
  { value: 'google/gemini-2.5-flash-lite',                    label: 'Gemini 2.5 Flash Lite' },
  { value: 'google/gemini-3-flash-preview',                   label: 'Gemini 3 Flash Preview' },
  // ── OpenAI ────────────────────────────────────────────────────────────────
  { value: 'openai/gpt-5-nano',                               label: 'GPT-5 Nano' },
  { value: 'openai/gpt-5-mini',                               label: 'GPT-5 Mini' },
  { value: 'openai/gpt-5',                                    label: 'GPT-5' },
  { value: 'openai/gpt-5.4-mini',                             label: 'GPT-5.4 Mini' },
  // ── Anthropic ─────────────────────────────────────────────────────────────
  { value: 'anthropic/claude-3.7-sonnet',                     label: 'Claude 3.7 Sonnet' },
  { value: 'anthropic/claude-sonnet-4.5',                     label: 'Claude Sonnet 4.5' },
  { value: 'anthropic/claude-opus-4',                         label: 'Claude Opus 4' },
  // ── Meta ──────────────────────────────────────────────────────────────────
  { value: 'meta-llama/llama-3.3-70b-instruct',               label: 'Llama 3.3 70B' },
  { value: 'meta-llama/llama-4-scout',                        label: 'Llama 4 Scout' },
  // ── DeepSeek ──────────────────────────────────────────────────────────────
  { value: 'deepseek/deepseek-chat',                          label: 'DeepSeek V3' },
  { value: 'deepseek/deepseek-v3.2',                          label: 'DeepSeek V3.2' },
  // ── Mistral ───────────────────────────────────────────────────────────────
  { value: 'mistralai/mistral-small-2603',                    label: 'Mistral Small 4' },
  // ── Qwen ──────────────────────────────────────────────────────────────────
  { value: 'qwen/qwen3-8b',                                   label: 'Qwen3 8B' },
  { value: 'qwen/qwen3-14b',                                  label: 'Qwen3 14B' },
  // ── xAI ───────────────────────────────────────────────────────────────────
  { value: 'x-ai/grok-3-mini',                                label: 'Grok 3 Mini' },
  { value: 'x-ai/grok-4-fast',                                label: 'Grok 4 Fast' },
  // ── Free ──────────────────────────────────────────────────────────────────
  { value: 'openrouter/free',                                 label: 'Free Router (Otomatis)' },
  { value: 'openai/gpt-oss-120b:free',                        label: 'GPT-OSS 120B (Free)' },
  { value: 'meta-llama/llama-3.3-70b-instruct:free',          label: 'Llama 3.3 70B (Free)' },
  { value: 'minimax/minimax-m2.5:free',                       label: 'MiniMax M2.5 (Free)' },
  { value: 'mistralai/mistral-small-3.1-24b-instruct:free',   label: 'Mistral Small 3.1 24B (Free)' },
  { value: 'google/gemma-3-27b-it:free',                      label: 'Gemma 3 27B (Free)' },
  { value: 'nvidia/nemotron-3-super-120b-a12b:free',          label: 'Nemotron 3 Super 120B (Free)' },
  { value: 'qwen/qwen3-4b:free',                              label: 'Qwen3 4B (Free)' },
];

const QUICK_PROMPTS = [
  'Bagaimana kondisi keuanganku secara keseluruhan?',
  'Berikan tips hemat untuk bulan ini berdasarkan data saya.',
  'Apakah porsi investasiku sudah cukup? Saran berikutnya?',
];

// ── Build system prompt from financial context ─────────────────────────────
function buildSystemPrompt(summary, transactions, categories, investments, savingsGoals, fmt) {
  const now     = new Date();
  const m       = now.getMonth();
  const y       = now.getFullYear();

  const monthTx = (transactions || []).filter(
    t => t.date && t.date.getMonth() === m && t.date.getFullYear() === y,
  );
  const monthIncome  = monthTx.filter(t => t.type === 'income') .reduce((a, t) => a + Number(t.amount), 0);
  const monthExpense = monthTx.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0);

  let healthInfo = '';
  try {
    const hs = calculateHealthScore(summary, transactions, categories);
    healthInfo = `Financial Health Score: ${hs.score}/100 (${
      hs.score >= 80 ? 'Sangat Baik' : hs.score >= 60 ? 'Baik' : hs.score >= 40 ? 'Cukup' : 'Perlu Perhatian'
    })\nBreakdown: ${hs.breakdown.map(b => `${b.label} ${b.score}/${b.max} (${b.detail})`).join(', ')}`;
  } catch { /* skip */ }

  const topExpenses = (() => {
    const map = {};
    monthTx.filter(t => t.type === 'expense').forEach(t => {
      map[t.category] = (map[t.category] || 0) + Number(t.amount);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([cat, amt]) => `${cat}: ${fmt(amt)}`).join(', ');
  })();

  const goalsInfo = (savingsGoals || []).map(g => {
    const pct = g.targetAmount > 0 ? ((g.currentAmount / g.targetAmount) * 100).toFixed(1) : 0;
    return `${g.icon || '🎯'} ${g.name}: ${fmt(g.currentAmount)}/${fmt(g.targetAmount)} (${pct}%)`;
  }).join('; ');

  const invInfo = (investments || []).slice(0, 5)
    .map(i => `${i.name}: ${fmt(i.currentValue || 0)}`).join(', ');

  return `Kamu adalah AI Financial Advisor personal yang cerdas, empatis, dan berbicara dalam Bahasa Indonesia yang ramah dan mudah dipahami.

Data keuangan pengguna (bulan ${now.toLocaleString('id-ID', { month: 'long', year: 'numeric' })}):
- Total Aset Bersih: ${fmt(summary?.netWorth || 0)}
- Saldo Kas Likuid: ${fmt(summary?.balance || 0)}
- Total Investasi: ${fmt(summary?.investment || 0)}
- Utang Kartu Kredit: ${fmt(Math.abs(summary?.ccDebt || 0))}
- Pemasukan Bulan Ini: ${fmt(monthIncome)}
- Pengeluaran Bulan Ini: ${fmt(monthExpense)}
- Top Kategori Pengeluaran: ${topExpenses || 'Belum ada data'}
- ${healthInfo}
${goalsInfo ? `- Target Tabungan: ${goalsInfo}` : ''}
${invInfo ? `- Portofolio Investasi: ${invInfo}` : ''}

Berikan jawaban yang personal, spesifik berdasarkan data di atas, dan praktis. Hindari jawaban generik. Gunakan angka nyata dari data pengguna. Jangan terlalu panjang — maksimal 300 kata per respons.`;
}

// ── API Calls ──────────────────────────────────────────────────────────────
async function callGemini(apiKey, messages, systemPrompt) {
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig:  { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini error: ${res.status}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Tidak ada respons.';
}

async function callOpenRouter(apiKey, model, messages, systemPrompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer':  window.location.origin,
      'X-Title':       'Dompet Keluarga AI Advisor',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenRouter error: ${res.status}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || 'Tidak ada respons.';
}

// ══════════════════════════════════════════════════════════════════════════
const AIAdvisorView = ({ summary, transactions, categories, investments, savingsGoals, fmt }) => {
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError]             = useState('');

  // Settings state — persisted to localStorage
  const [provider,  setProvider]  = useState(() => localStorage.getItem(LS_PROVIDER)  || 'gemini');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem(LS_GEMINI_KEY) || '');
  const [orKey,     setOrKey]     = useState(() => localStorage.getItem(LS_OR_KEY)     || '');
  const [orModel,   setOrModel]   = useState(() => localStorage.getItem(LS_OR_MODEL)   || OR_MODELS[0].value);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // Persist settings
  useEffect(() => { localStorage.setItem(LS_PROVIDER,   provider);  }, [provider]);
  useEffect(() => { localStorage.setItem(LS_GEMINI_KEY, geminiKey); }, [geminiKey]);
  useEffect(() => { localStorage.setItem(LS_OR_KEY,     orKey);     }, [orKey]);
  useEffect(() => { localStorage.setItem(LS_OR_MODEL,   orModel);   }, [orModel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const activeKey = provider === 'gemini' ? geminiKey : orKey;

  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText || isLoading) return;

    if (!activeKey) {
      setShowSettings(true);
      setError(`Silakan masukkan API key ${provider === 'gemini' ? 'Gemini' : 'OpenRouter'} dulu.`);
      return;
    }
    setError('');

    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const systemPrompt = buildSystemPrompt(summary, transactions, categories, investments, savingsGoals, fmt);

    try {
      let reply;
      if (provider === 'gemini') {
        reply = await callGemini(geminiKey, newMessages, systemPrompt);
      } else {
        reply = await callOpenRouter(orKey, orModel, newMessages, systemPrompt);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(err.message);
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Gagal mendapatkan respons: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => { setMessages([]); setError(''); };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] space-y-0">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-gray-800 rounded-t-xl border border-gray-100 dark:border-gray-700 p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
            <Bot size={20} className="text-emerald-600 dark:text-emerald-400"/>
          </div>
          <div>
            <h2 className="font-bold text-gray-800 dark:text-gray-100">AI Financial Advisor</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Powered by {provider === 'gemini' ? 'Google Gemini 2.0 Flash' : `OpenRouter · ${OR_MODELS.find(m => m.value === orModel)?.label || orModel}`}
              {activeKey && <span className="ml-1 text-emerald-500">✓</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Hapus percakapan"
            >
              <RefreshCw size={16}/>
            </button>
          )}
          <button
            onClick={() => setShowSettings(v => !v)}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <Settings size={18}/>
          </button>
        </div>
      </div>

      {/* ── Settings Panel ── */}
      {showSettings && (
        <div className="bg-amber-50 dark:bg-gray-800/80 border-x border-amber-100 dark:border-gray-700 p-4 shrink-0 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5"><Key size={14}/> Konfigurasi AI</p>
            <button onClick={() => { setShowSettings(false); setError(''); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={16}/>
            </button>
          </div>

          {/* Provider toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setProvider('gemini')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all border ${provider === 'gemini' ? 'bg-white dark:bg-gray-700 border-emerald-500 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-300/50' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700'}`}
            >
              Google Gemini
            </button>
            <button
              onClick={() => setProvider('openrouter')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all border ${provider === 'openrouter' ? 'bg-white dark:bg-gray-700 border-emerald-500 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-300/50' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700'}`}
            >
              OpenRouter
            </button>
          </div>

          {provider === 'gemini' ? (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Google Gemini API Key
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-500 hover:underline">→ Dapatkan</a>
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value.trim())}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="AIzaSy..."
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  OpenRouter API Key
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-500 hover:underline">→ Dapatkan</a>
                </label>
                <input
                  type="password"
                  value={orKey}
                  onChange={e => setOrKey(e.target.value.trim())}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="sk-or-..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Model</label>
                <div className="relative">
                  <select
                    value={orModel}
                    onChange={e => setOrModel(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none appearance-none pr-8"
                  >
                    {OR_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                </div>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            🔒 API key hanya disimpan di perangkat ini (localStorage), tidak dikirim ke server kami.
          </p>
          {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>}
        </div>
      )}

      {/* ── Chat Area ── */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 border-x border-gray-100 dark:border-gray-700 p-4 space-y-4 min-h-0">

        {/* Welcome / empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-8">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl">
              <Sparkles size={32} className="text-emerald-500"/>
            </div>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300 text-lg">Halo! Ada yang bisa aku bantu?</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Aku tahu kondisi keuanganmu — tanya apa saja!
              </p>
            </div>
            {!activeKey && (
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm"
              >
                <Key size={16}/> Atur API Key dulu
              </button>
            )}
            {/* Quick prompts */}
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p)}
                  disabled={isLoading}
                  className="text-left text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-gray-600 dark:text-gray-300 disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-br-md'
                  : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-bl-md shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading dots */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1.5 items-center h-4">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* ── Quick prompts (when already chatting) ── */}
      {messages.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border-x border-t border-gray-100 dark:border-gray-700 px-3 py-2 flex gap-2 overflow-x-auto shrink-0">
          {QUICK_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => sendMessage(p)}
              disabled={isLoading}
              className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors disabled:opacity-50 shrink-0"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="bg-white dark:bg-gray-800 rounded-b-xl border border-t-0 border-gray-100 dark:border-gray-700 p-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
            placeholder="Ketik pertanyaanmu… (Enter untuk kirim)"
            className="flex-1 resize-none p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-gray-50 dark:bg-gray-700 dark:text-white transition-all max-h-32 overflow-y-auto disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 active:scale-95"
          >
            <Send size={18}/>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAdvisorView;
