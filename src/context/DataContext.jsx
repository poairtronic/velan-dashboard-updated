import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useFilters } from './FilterContext';
import { useUI } from './UIContext';
import { fetchData, saveRows, importRows, resetDB } from '../services/dataService';
import { fetchDataUrl } from '../services/sheetsService';
import { normalizeRow } from '../utils/normalizeRow';
import { workingDaysBetween, normalizeProductsInGroup } from '../utils/calculationUtils';
import { useKPIs } from '../hooks/useKPIs';
import useDashboardData from '../hooks/useDashboardData';
import useLiveSync from '../hooks/useLiveSync';
import useUploadHandlers from '../hooks/useUploadHandlers';
import { normalizeGoogleSheetsUrl } from '../services/googleSheets';
import { toast } from 'react-hot-toast';
import { logger } from '../utils/logger';
const DataContext = createContext();

export function DataProvider({ children }) {
  const { user, isAdmin } = useAuth();
  const { filterRows } = useFilters();
  const { 
    setServerStatus, setIsLoading, setUploadStatus, 
    setImportState, liveState, setLiveState 
  } = useUI();

  const [data, setData] = useState([]);
  const [liveRows, setLiveRows] = useState([]);
  const [lastSync, setLastSync] = useState('');
  
  const [liveConfig, setLiveConfig] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('velan_live_source_v1') || '{}');
      return { enabled: stored.enabled === true, url: typeof stored.url === 'string' ? stored.url : '', intervalSec: Number(stored.intervalSec) || 300 };
    } catch { return { enabled: false, url: '', intervalSec: 300 }; }
  });

  const [historyConfig, setHistoryConfig] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('velan_history_source_v1') || '{}');
      return { url: typeof stored.url === 'string' ? stored.url : '' };
    } catch { return { url: '' }; }
  });

  useEffect(() => localStorage.setItem('velan_live_source_v1', JSON.stringify(liveConfig || {})), [liveConfig]);
  useEffect(() => localStorage.setItem('velan_history_source_v1', JSON.stringify(historyConfig || {})), [historyConfig]);

  const [todayStr, setTodayStr] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      const current = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      setTodayStr(prev => prev !== current ? current : prev);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Use dashboard data fetcher
  useDashboardData({ setData, setLiveRows, setLastSync, setServerStatus, setIsLoading, setLiveConfig, setHistoryConfig });

  // Network actions
  const saveRowsToServer = useCallback((rows, syncType = 'Manual Upload') => {
    if (!rows || rows.length === 0) return;
    saveRows(rows, syncType)
      .then(result => {
        if (result && result.success) {
          if (result.lastSync) setLastSync(result.lastSync);
          return fetchData().then(payload => {
            setData(Array.isArray(payload.rows) ? payload.rows : []);
            setLiveRows(Array.isArray(payload.liveRows) ? payload.liveRows : []);
            setUploadStatus({
              type: 'success',
              msg: `✅ Saved ${rows.length} rows to live dashboard`,
              detail: `Live: ${result.liveTotal} rows | DB: ${result.total} rows total (+${result.newRows || 0} new entries added to Database).`,
            });
            toast.success('Live dashboard data saved.');
          });
        }
      })
      .catch(err => {
        logger.error('saveRowsToServer failed:', err);
        setUploadStatus({
          type: 'warn',
          msg: '⚠ Backend save failed',
          detail: 'Data is loaded locally, but backend storage is unavailable.',
        });
        toast.error('Failed to save data to backend.');
      });
  }, [setUploadStatus]);

  const importRowsToDb = useCallback((rows) => {
    if (!rows || rows.length === 0) return;
    setImportState({ loading: true, lastMsg: 'Importing…' });
    
    importRows(rows)
      .then(result => {
        const msg = result.success
          ? '✅ Imported ' + result.imported + ' new rows to DB (' + result.skipped + ' duplicates skipped). Total DB: ' + result.total
          : '❌ Import failed';
        setImportState({ loading: false, lastMsg: msg });
        if (result.success) toast.success('Data imported to history successfully.');
        else toast.error('Import failed.');
        return fetchData().then(payload => {
          setData(Array.isArray(payload.rows) ? payload.rows : []);
        });
      })
      .catch(err => {
        logger.error('importRowsToDb failed:', err);
        setImportState({ loading: false, lastMsg: '❌ ' + String(err.message || err) });
        toast.error('Failed to import data: ' + (err.message || String(err)));
      });
  }, [setImportState]);

  const syncHistorySheet = useCallback(async () => {
    const url = String(historyConfig.url || '').trim();
    if (!url) {
      setImportState({ loading: false, lastMsg: '❌ No backup sheet URL set.' });
      toast.error('No backup sheet URL set.');
      return;
    }
    setImportState({ loading: true, lastMsg: 'Fetching backup data from Google Sheet…' });
    try {
      const rawRows = await fetchDataUrl(url);
      if (!rawRows || rawRows.length === 0) {
        setImportState({ loading: false, lastMsg: '❌ No rows found in backup sheet.' });
        toast.error('No rows found in backup sheet.');
        return;
      }
      const normalized = rawRows.map(normalizeRow).filter(r => r && (r.sc || r.po));
      importRowsToDb(normalized);
    } catch (err) {
      logger.error('syncHistorySheet failed:', err);
      setImportState({ loading: false, lastMsg: '❌ Fetch error: ' + String(err) });
      toast.error('Failed to fetch backup data.');
    }
  }, [historyConfig.url, importRowsToDb, setImportState]);

  const resetDBAction = useCallback(async () => {
    if (!window.confirm('⚠️ DANGER: This will permanently DELETE ALL rows from the Neon database.\n\nThis CANNOT be undone.\n\nClick OK only if you want to clear history and start fresh.')) return;
    setImportState({ loading: true, lastMsg: '⏳ Clearing database…' });
    
    try {
      const json = await resetDB();
      if (json.success) {
        setData([]);
        setImportState({ loading: false, lastMsg: '✅ Database cleared. All history rows deleted. Re-import your 2K dataset using History Import above.' });
        toast.success('Database cleared.');
      } else {
        setImportState({ loading: false, lastMsg: '❌ Reset failed: ' + (json.error || 'Unknown error') });
        toast.error('Reset failed: ' + (json.error || 'Unknown error'));
      }
    } catch (err) {
      logger.error('resetDBAction failed:', err);
      setImportState({ loading: false, lastMsg: '❌ Reset error: ' + String(err) });
      toast.error('Reset error: ' + String(err));
    } finally {
      // Ensure loading state is reset if it wasn't already
      setImportState(prev => ({ ...prev, loading: false }));
    }
  }, [setImportState]);

  const uploadHandlers = useUploadHandlers({
    setLiveRows, setData, setLastSync, setUploadStatus, setImportState, saveRowsToServer, importRowsToDb,
  });
  const { handleFileUpload, handleHistoryFileUpload, handleHistoryDragDrop } = uploadHandlers;

  const syncLiveDataNow = useCallback(async (urlOverride) => {
    const sourceUrl = String(urlOverride || liveConfig.url || '').trim();
    if (!sourceUrl) {
      setUploadStatus({ type: 'error', msg: 'Live source URL is empty.', detail: 'Paste your Google Sheets URL (share link, edit link, or CSV export link).' });
      toast.error('Live source URL is empty.');
      return;
    }

    const normalized = normalizeGoogleSheetsUrl(sourceUrl);
    const isGSheets  = normalized.includes('docs.google.com/spreadsheets');
    setUploadStatus({ type: 'loading', msg: '🔄 Syncing live source…', detail: isGSheets ? `Google Sheets → CSV export → ${normalized.substring(0, 60)}…` : sourceUrl });

    try {
      const rows = await fetchDataUrl(sourceUrl);
      if (!rows || rows.length === 0) {
        setUploadStatus({ type: 'error', msg: 'No valid rows found in file.', detail: 'Check that the file has data and correct column names.' });
        toast.error('No valid rows found in live source.');
        return;
      }
      const normalizedRows = rows.map(normalizeRow).filter(r => r && (r.sc || r.po));
      const missingStage = normalizedRows.filter(r => !r.currentStage).length;
      setLiveRows(normalizedRows);
      saveRowsToServer(normalizedRows, 'Google Sheets Sync');

      const sourceName = isGSheets ? 'GOOGLE SHEETS (LIVE)' : 'LIVE SOURCE';
      setUploadStatus({ type: 'success', msg: `✅ ${normalizedRows.length} rows loaded from "${sourceName}" — live latest status resolved`, detail: missingStage > 0 ? `⚠ ${missingStage} rows have no stage value` : null });
      setLiveState({ active: true, lastSync: new Date().toLocaleString('en-IN'), lastError: '' });
      toast.success('Live sync completed.');
    } catch (err) {
      logger.error('syncLiveDataNow failed:', err);
      setLiveState(prev => ({ ...prev, active: false, lastError: String(err) }));
      setUploadStatus({ type: 'error', msg: 'Live sync failed.', detail: `${String(err)}\n\n💡 For Google Sheets: File → Share → Publish to web → Entire Document → CSV → Publish\n   Copy the /pub?output=csv link and paste it above.` });
      toast.error('Live sync failed. Check URL or network.');
    }
  }, [liveConfig.url, saveRowsToServer, setUploadStatus, setLiveState]);

  useLiveSync(liveConfig, syncLiveDataNow);

  // Computed data
  const processedData = useMemo(() => {
    return data.map(row => ({
      ...row,
      pendingDays: row.timestamp ? workingDaysBetween(row.timestamp, todayStr) : null,
      cycleTime: (row.timestamp && row.poDate) ? workingDaysBetween(row.poDate, row.timestamp) : null,
    }));
  }, [data, todayStr]);

  const allDbData = useMemo(() => {
    const seen = new Set();
    const liveProcessed = liveRows.map(row => ({
      ...row,
      currentStage: row.currentStage || row.op || row.OP || '',
      _isLive: true,
      pendingDays: row.timestamp ? workingDaysBetween(row.timestamp, todayStr) : null,
      cycleTime: (row.timestamp && row.poDate) ? workingDaysBetween(row.poDate, row.timestamp) : null,
    }));
    const dbProcessed = processedData.map(row => ({
      ...row,
      currentStage: row.currentStage || row.op || row.OP || '',
      _isLive: false,
    }));
    return [...liveProcessed, ...dbProcessed].filter(r => {
      const key = (r.sc||'') + '||' + (r.po||'') + '||' + (r.product||'') + '||' + (r.currentStage||'') + '||' + (r.timestamp||'');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [processedData, liveRows, todayStr]);

  const liveData = useMemo(() => {
    return liveRows.map(row => ({
      ...row,
      pendingDays: row.timestamp ? workingDaysBetween(row.timestamp, todayStr) : null,
      cycleTime: (row.timestamp && row.poDate) ? workingDaysBetween(row.poDate, row.timestamp) : null,
    }));
  }, [liveRows, todayStr]);

  const filtered = useMemo(() => filterRows(liveData), [liveData, filterRows]);

  const scGroups = useMemo(() => {
    const g = {};
    liveData.forEach(row => {
      if (!g[row.sc]) g[row.sc] = { sc: row.sc, po: row.po, poDate: row.poDate, _all: [] };
      g[row.sc]._all.push(row);
    });
    return Object.values(g).map(sg => {
      const latestMap = {};
      const normalizedRows = normalizeProductsInGroup(sg._all);
      normalizedRows.forEach(r => {
        const key = (r.product || '__none__').trim();
        const ex = latestMap[key];
        if (!ex) { latestMap[key] = r; return; }
        if (r._isLive && !ex._isLive) { latestMap[key] = r; return; }
        if (!r._isLive && ex._isLive) return;
        if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) latestMap[key] = r;
      });
      return { sc: sg.sc, po: sg.po, poDate: sg.poDate, items: Object.values(latestMap) };
    });
  }, [liveData]);

  const poGroups = useMemo(() => {
    const g = {};
    liveData.forEach(row => {
      if (!g[row.po]) g[row.po] = { po: row.po, poDate: row.poDate, items: [] };
      g[row.po].items.push(row);
    });
    return Object.values(g);
  }, [liveData]);

  const kpis = useKPIs(filtered, scGroups, poGroups, liveData, todayStr);

  const uniquePOs     = useMemo(() => [...new Set(liveData.map(r => r.po))].sort(), [liveData]);
  const uniqueStages  = useMemo(() => [...new Set(liveData.map(r => r.currentStage))].filter(Boolean).sort(), [liveData]);
  const uniqueTypes   = useMemo(() => [...new Set(liveData.map(r => r.type))].filter(Boolean).sort(), [liveData]);

  const contextValue = useMemo(() => ({
    data, liveRows, lastSync,
    liveConfig, setLiveConfig, liveState, setLiveState,
    historyConfig, setHistoryConfig,
    saveRowsToServer, importRowsToDb, syncHistorySheet, resetDB: resetDBAction,
    handleFileUpload, handleHistoryFileUpload, handleHistoryDragDrop, syncLiveDataNow,
    processedData, allDbData, liveData, filtered, scGroups, poGroups,
    kpis, uniquePOs, uniqueStages, uniqueTypes
  }), [
    data, liveRows, lastSync, liveConfig, liveState, historyConfig,
    saveRowsToServer, importRowsToDb, syncHistorySheet, resetDBAction,
    handleFileUpload, handleHistoryFileUpload, handleHistoryDragDrop, syncLiveDataNow,
    processedData, allDbData, liveData, filtered, scGroups, poGroups,
    kpis, uniquePOs, uniqueStages, uniqueTypes
  ]);

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}
