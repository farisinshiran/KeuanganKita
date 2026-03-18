/**
 * useAppData.js
 * Custom hook that encapsulates all Firestore onSnapshot subscriptions.
 * Accepts a `refreshKey` (number) — incrementing it re-runs all subscriptions
 * without a full page reload, replacing the previous window.location.reload(true).
 */
import { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, query, onSnapshot, orderBy,
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';
import { parseDate } from '../utils/formatters';
import {
  DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES,
  DEFAULT_INVESTMENT_TYPES, DEFAULT_WALLETS,
} from '../constants/categories';

const EMPTY_CATEGORIES = { expense: [], income: [], raw: [] };

export function useAppData(user, refreshKey = 0) {
  const [transactions, setTransactions]   = useState([]);
  const [investments, setInvestments]     = useState([]);
  const [categories, setCategories]       = useState(EMPTY_CATEGORIES);
  const [investTypes, setInvestTypes]     = useState([]);
  const [wallets, setWallets]             = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [savingsGoals, setSavingsGoals]   = useState([]);
  const [dataLoading, setDataLoading]     = useState(true);

  // Seed guards — reset when user or refreshKey changes
  const walletsInit    = useRef(false);
  const invTypesInit   = useRef(false);
  const categoriesInit = useRef(false);

  useEffect(() => {
    if (!user) {
      // State already initialised to empty defaults; just reset seed guards
      walletsInit.current    = false;
      invTypesInit.current   = false;
      categoriesInit.current = false;
      return;
    }


    // Reset seed guards on every subscription cycle
    walletsInit.current    = false;
    invTypesInit.current   = false;
    categoriesInit.current = false;


    const uid  = user.uid;
    const base = (col) => collection(db, 'artifacts', appId, 'users', uid, col);
    const dedup = (arr, keyFn) => { const seen = new Set(); return arr.filter(x => seen.has(keyFn(x)) ? false : seen.add(keyFn(x))); };

    // ── Transactions ────────────────────────────────────────
    const unsubTrans = onSnapshot(
      query(base('transactions'), orderBy('date', 'desc')),
      s => {
        setTransactions(s.docs.map(d => ({ id: d.id, ...d.data(), date: parseDate(d.data().date) })));
        setDataLoading(false);
      },
      err => { console.error('transactions snapshot error', err); setDataLoading(false); }
    );

    // ── Investments ─────────────────────────────────────────
    const unsubInv = onSnapshot(
      query(base('investments')),
      s => setInvestments(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    // ── Categories (with default seed) ──────────────────────
    const unsubCats = onSnapshot(query(base('categories')), async s => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length === 0 && !categoriesInit.current) {
        categoriesInit.current = true;
        const defaults = [
          ...DEFAULT_EXPENSE_CATEGORIES.map(n => ({ name: n, type: 'expense', budget: 0 })),
          ...DEFAULT_INCOME_CATEGORIES.map(n  => ({ name: n, type: 'income',  budget: 0 })),
        ];
        await Promise.all(defaults.map(c => addDoc(base('categories'), c))).catch(console.error);
      } else if (data.length > 0) {
        const unique = dedup(data, c => `${c.type}|${c.name}`);
        setCategories({
          expense: unique.filter(c => c.type === 'expense').map(c => c.name).sort(),
          income:  unique.filter(c => c.type === 'income').map(c => c.name).sort(),
          raw: unique,
        });
      }
    });

    // ── Investment types (with default seed) ────────────────
    const unsubInvTypes = onSnapshot(query(base('investment_types')), async s => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length === 0 && !invTypesInit.current) {
        invTypesInit.current = true;
        await Promise.all(DEFAULT_INVESTMENT_TYPES.map(t => addDoc(base('investment_types'), t))).catch(console.error);
      } else if (data.length > 0) {
        setInvestTypes(dedup(data, t => t.name));
      }
    });

    // ── Wallets (with default seed) ─────────────────────────
    const unsubWallets = onSnapshot(query(base('wallets')), async s => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length === 0 && !walletsInit.current) {
        walletsInit.current = true;
        await Promise.all(DEFAULT_WALLETS.map(w => addDoc(base('wallets'), w))).catch(console.error);
      } else if (data.length > 0) {
        setWallets(dedup(data, w => w.name));
      }
    });

    // ── Subscriptions ───────────────────────────────────────
    const unsubSubs = onSnapshot(
      query(base('subscriptions')),
      s => setSubscriptions(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    // ── Savings Goals ───────────────────────────────────────
    const unsubGoals = onSnapshot(
      query(base('savings_goals')),
      s => setSavingsGoals(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsubTrans();
      unsubInv();
      unsubCats();
      unsubInvTypes();
      unsubWallets();
      unsubSubs();
      unsubGoals();
    };
  }, [user, refreshKey]);


  return { transactions, investments, categories, investTypes, wallets, subscriptions, savingsGoals, dataLoading };
}
