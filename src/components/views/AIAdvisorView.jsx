import React, { useState, useRef, useEffect } from 'react';
import Icon from '../ui/Icon.jsx';
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
      'X-Title':       'KeuanganKita AI Advisor',
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
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)]">

      {/* ── Settings Modal Overlay ── */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in" onClick={() => { setShowSettings(false); setError(''); }}>
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl w-full max-w-md animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-outline-variant/20">
              <h3 className="font-bold text-on-surface flex items-center gap-2">
                <Icon name="settings" size={20} className="text-primary" /> Konfigurasi AI
              </h3>
              <button onClick={() => { setShowSettings(false); setError(''); }} className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant transition-colors">
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Provider toggle */}
              <div className="flex gap-2 bg-surface-container-low p-1.5 rounded-xl">
                <button
                  onClick={() => setProvider('gemini')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${provider === 'gemini' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  Google Gemini
                </button>
                <button
                  onClick={() => setProvider('openrouter')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${provider === 'openrouter' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  OpenRouter
                </button>
              </div>

              {provider === 'gemini' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant">
                    Google Gemini API Key
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="ml-1 text-primary hover:underline">→ Dapatkan</a>
                  </label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={e => setGeminiKey(e.target.value.trim())}
                    className="w-full p-3 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm"
                    placeholder="AIzaSy..."
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-on-surface-variant">
                      OpenRouter API Key
                      <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="ml-1 text-primary hover:underline">→ Dapatkan</a>
                    </label>
                    <input
                      type="password"
                      value={orKey}
                      onChange={e => setOrKey(e.target.value.trim())}
                      className="w-full p-3 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm"
                      placeholder="sk-or-..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-on-surface-variant">Model</label>
                    <select
                      value={orModel}
                      onChange={e => setOrModel(e.target.value)}
                      className="w-full p-3 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm appearance-none"
                    >
                      {OR_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <p className="text-xs text-on-surface-variant bg-surface-container-low p-3 rounded-xl">
                🔒 API key hanya disimpan di perangkat ini (localStorage), tidak dikirim ke server kami.
              </p>
              {error && <p className="text-xs text-error bg-error-container p-3 rounded-xl">{error}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="bg-surface-container-lowest rounded-t-2xl p-4 flex justify-between items-center shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-2xl">
            <Icon name="psychology" size={22} className="text-primary" fill={1} />
          </div>
          <div>
            <h2 className="font-bold text-on-surface">AI Financial Advisor</h2>
            <p className="text-xs text-on-surface-variant">
              {provider === 'gemini' ? 'Google Gemini 2.0 Flash' : `OpenRouter · ${OR_MODELS.find(m => m.value === orModel)?.label || orModel}`}
              {activeKey && <span className="ml-1 text-secondary">✓</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-1 items-center">
          {messages.length > 0 && (
            <button onClick={clearChat} className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors" title="Hapus percakapan">
              <Icon name="refresh" size={18} />
            </button>
          )}
          <button
            onClick={() => setShowSettings(v => !v)}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div className="flex-1 overflow-y-auto bg-surface-container/30 p-4 space-y-4 min-h-0">

        {/* Welcome / empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-8">
            <div className="p-5 bg-primary/10 rounded-3xl">
              <Icon name="auto_awesome" size={36} className="text-primary" fill={1} />
            </div>
            <div>
              <p className="font-bold text-on-surface text-lg">Halo! Ada yang bisa aku bantu?</p>
              <p className="text-sm text-on-surface-variant mt-1">Aku tahu kondisi keuanganmu — tanya apa saja!</p>
            </div>
            {!activeKey && (
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all text-sm"
              >
                <Icon name="key" size={16} /> Atur API Key dulu
              </button>
            )}
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p)}
                  disabled={isLoading}
                  className="text-left text-sm bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 hover:border-primary/30 hover:bg-primary/5 transition-colors text-on-surface disabled:opacity-50"
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
            <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-primary text-on-primary rounded-br-sm'
                : 'bg-surface-container-lowest text-on-surface border border-outline-variant/20 rounded-bl-sm shadow-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading dots */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1.5 items-center h-4">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Quick prompts (when already chatting) ── */}
      {messages.length > 0 && (
        <div className="bg-surface-container-lowest border-t border-outline-variant/10 px-3 py-2 flex gap-2 overflow-x-auto shrink-0">
          {QUICK_PROMPTS.map((p, i) => (
            <button
              key={i}
              onClick={() => sendMessage(p)}
              disabled={isLoading}
              className="text-xs bg-surface-container text-on-surface-variant px-3 py-1.5 rounded-full whitespace-nowrap hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50 shrink-0"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="bg-surface-container-lowest rounded-b-2xl p-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
            placeholder="Ketik pertanyaanmu… (Enter untuk kirim)"
            className="flex-1 resize-none p-3 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-sm text-on-surface transition-all max-h-32 overflow-y-auto disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            className="p-3 bg-primary text-on-primary rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all shrink-0"
          >
            <Icon name="send" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAdvisorView;
