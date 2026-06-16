import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useFilters } from './FilterContext';
import { useUI } from './UIContext';
import { fetchData, saveRows, importRows, resetDB } from '../services/dataService';
import { fetchDataUrl } from '../services/sheetsService';
import { normalizeRow } from '../utils/normalizeRow';
import { workingDaysBetween, normalizeProductsInGroup } from '../utils/calculationUtils';
import { useBackendKPIs } from '../hooks/useBackendKPIs';
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
    setServerStatus,
    setIsLoading,
    setUploadStatus,
    setImportState,
    liveState,
    setLiveState,
  } = useUI();

  const [data, setData] = useState([]);
  const [liveRows, setLiveRows] = useState([]);
  const [lastSync, setLastSync] = useState('');

  const [liveConfig, setLiveConfig] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('velan_live_source_v1') || '{}');
      return {
        enabled: stored.enabled === true,
        url: typeof stored.url === 'string' ? stored.url : '',
        intervalSec: Number(stored.intervalSec) || 300,
      };
    } catch {
      return { enabled: false, url: '', intervalSec: 300 };
    }
  });

  const [historyConfig, setHistoryConfig] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('velan_history_source_v1') || '{}');
      return { url: typeof stored.url === 'string' ? stored.url : '' };
    } catch {
      return { url: '' };
    }
  });

  useEffect(
    () => localStorage.setItem('velan_live_source_v1', JSON.stringify(liveConfig || {})),
    [liveConfig]
  );
  useEffect(
    () => localStorage.setItem('velan_history_source_v1', JSON.stringify(historyConfig || {})),
    [historyConfig]
  );

  const [todayStr, setTodayStr] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      const current = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setTodayStr((prev) => (prev !== current ? current : prev));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Use dashboard data fetcher
  useDashboardData({
    setData,
    setLiveRows,
    setLastSync,
    setServerStatus,
    setIsLoading,
    setLiveConfig,
    setHistoryConfig,
  });

  const queryClient = useQueryClient();

  const saveRowsMutation = useMutation({
    mutationFn: ({ rows, syncType }) => saveRows(rows, syncType),
    onSuccess: (result, variables) => {
      if (result && result.success) {
        if (result.lastSync) setLastSync(result.lastSync);
        queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
        setUploadStatus({
          type: 'success',
          msg: `✅ Saved ${variables.rows.length} rows to live dashboard`,
          detail: `Live: ${result.liveTotal} rows | DB: ${result.total} rows total (+${result.newRows || 0} new entries added to Database).`,
        });
        toast.success('Live dashboard data saved.');
      }
    },
    onError: (err) => {
      logger.error('saveRowsToServer failed:', err);
      setUploadStatus({
        type: 'warn',
        msg: '⚠ Backend save failed',
        detail: 'Data is loaded locally, but backend storage is unavailable.',
      });
      toast.error('Failed to save data to backend.');
    }
  });

  const importRowsMutation = useMutation({
    mutationFn: (rows) => importRows(rows),
    onSuccess: (result) => {
      const msg = result.success
        ? '✅ Imported ' +
          result.imported +
          ' new rows to DB (' +
          result.skipped +
          ' duplicates skipped). Total DB: ' +
          result.total
        : '❌ Import failed';
      setImportState({ loading: false, lastMsg: msg });
      if (result.success) toast.success('Data imported to history successfully.');
      else toast.error('Import failed.');
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
    },
    onError: (err) => {
      logger.error('importRowsToDb failed:', err);
      setImportState({ loading: false, lastMsg: '❌ ' + String(err.message || err) });
      toast.error('Failed to import data: ' + (err.message || String(err)));
    }
  });

  const resetDBMutation = useMutation({
    mutationFn: () => resetDB(),
    onSuccess: (json) => {
      if (json.success) {
        setData([]);
        setImportState({
          loading: false,
          lastMsg:
            '✅ Database cleared. All history rows deleted. Re-import your dataset using History Import above.',
        });
        toast.success('Database cleared.');
        queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      } else {
        setImportState({
          loading: false,
          lastMsg: '❌ Reset failed: ' + (json.error || 'Unknown error'),
        });
        toast.error('Reset failed: ' + (json.error || 'Unknown error'));
      }
    },
    onError: (err) => {
      logger.error('resetDBAction failed:', err);
      setImportState({ loading: false, lastMsg: '❌ Reset error: ' + String(err) });
      toast.error('Reset error: ' + String(err));
    }
  });

  // Network actions
  const saveRowsToServer = useCallback(
    (rows, syncType = 'Manual Upload') => {
      if (!rows || rows.length === 0) return;
      saveRowsMutation.mutate({ rows, syncType });
    },
    [saveRowsMutation]
  );

  const importRowsToDb = useCallback(
    (rows) => {
      if (!rows || rows.length === 0) return;
      setImportState({ loading: true, lastMsg: 'Importing…' });
      importRowsMutation.mutate(rows);
    },
    [importRowsMutation, setImportState]
  );

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
      const normalized = rawRows.map(normalizeRow).filter((r) => r && (r.sc || r.po));
      importRowsToDb(normalized);
    } catch (err) {
      logger.error('syncHistorySheet failed:', err);
      setImportState({ loading: false, lastMsg: '❌ Fetch error: ' + String(err) });
      toast.error('Failed to fetch backup data.');
    }
  }, [historyConfig.url, importRowsToDb, setImportState]);

  const resetDBAction = useCallback(() => {
    if (
      !window.confirm(
        '⚠️ DANGER: This will permanently DELETE ALL rows from the Neon database.\n\nThis CANNOT be undone.\n\nClick OK only if you want to clear history and start fresh.'
      )
    )
      return;
    setImportState({ loading: true, lastMsg: '⏳ Clearing database…' });
    resetDBMutation.mutate();
  }, [resetDBMutation, setImportState]);

  const uploadHandlers = useUploadHandlers({
    setLiveRows,
    setData,
    setLastSync,
    setUploadStatus,
    setImportState,
    saveRowsToServer,
    importRowsToDb,
  });
  const { handleFileUpload, handleHistoryFileUpload, handleHistoryDragDrop } = uploadHandlers;

  const syncLiveDataNow = useCallback(
    async (urlOverride) => {
      const sourceUrl = String(urlOverride || liveConfig.url || '').trim();
      if (!sourceUrl) {
        setUploadStatus({
          type: 'error',
          msg: 'Live source URL is empty.',
          detail: 'Paste your Google Sheets URL (share link, edit link, or CSV export link).',
        });
        toast.error('Live source URL is empty.');
        return;
      }

      const normalized = normalizeGoogleSheetsUrl(sourceUrl);
      const isGSheets = normalized.includes('docs.google.com/spreadsheets');
      setUploadStatus({
        type: 'loading',
        msg: '🔄 Syncing live source…',
        detail: isGSheets
          ? `Google Sheets → CSV export → ${normalized.substring(0, 60)}…`
          : sourceUrl,
      });

      try {
        const rows = await fetchDataUrl(sourceUrl);
        if (!rows || rows.length === 0) {
          setUploadStatus({
            type: 'error',
            msg: 'No valid rows found in file.',
            detail: 'Check that the file has data and correct column names.',
          });
          toast.error('No valid rows found in live source.');
          return;
        }
        const normalizedRows = rows.map(normalizeRow).filter((r) => r && (r.sc || r.po));
        const missingStage = normalizedRows.filter((r) => !r.currentStage).length;
        setLiveRows(normalizedRows);
        saveRowsToServer(normalizedRows, 'Google Sheets Sync');

        const sourceName = isGSheets ? 'GOOGLE SHEETS (LIVE)' : 'LIVE SOURCE';
        setUploadStatus({
          type: 'success',
          msg: `✅ ${normalizedRows.length} rows loaded from "${sourceName}" — live latest status resolved`,
          detail: missingStage > 0 ? `⚠ ${missingStage} rows have no stage value` : null,
        });
        setLiveState({ active: true, lastSync: new Date().toLocaleString('en-IN'), lastError: '' });
        toast.success('Live sync completed.');
      } catch (err) {
        logger.error('syncLiveDataNow failed:', err);
        setLiveState((prev) => ({ ...prev, active: false, lastError: String(err) }));
        setUploadStatus({
          type: 'error',
          msg: 'Live sync failed.',
          detail: `${String(err)}\n\n💡 For Google Sheets: File → Share → Publish to web → Entire Document → CSV → Publish\n   Copy the /pub?output=csv link and paste it above.`,
        });
        toast.error('Live sync failed. Check URL or network.');
      }
    },
    [liveConfig.url, saveRowsToServer, setUploadStatus, setLiveState]
  );

  useLiveSync(liveConfig, syncLiveDataNow);

  // We use the new backend KPIs hook which handles React Query internally
  const kpis = useBackendKPIs(useFilters().filters);

  // We no longer keep massive filtered arrays in Context. 
  // Pages will use useProductionDataQuery to fetch paginated data when they need tables.

  // We still provide unique lists for dropdowns (POs, Stages, Types). 
  // In a real 100K system we'd fetch these from a dedicated /api/options endpoint,
  // but for now we extract them from the paginated liveRows we have (or leave them empty to fetch on demand).
  // Ideally, filter dropdowns should be populated from a fast backend query.
  const uniquePOs = useMemo(() => [...new Set(liveRows.map((r) => r.po))].sort(), [liveRows]);
  const uniqueStages = useMemo(
    () => [...new Set(liveRows.map((r) => r.currentStage))].filter(Boolean).sort(),
    [liveRows]
  );
  const uniqueTypes = useMemo(
    () => [...new Set(liveRows.map((r) => r.type))].filter(Boolean).sort(),
    [liveRows]
  );

  const contextValue = useMemo(
    () => ({
      data, // Raw unpaginated data is no longer fully populated, but kept for legacy checks
      liveRows, // Same here, mostly used for dropdowns now
      lastSync,
      liveConfig,
      setLiveConfig,
      liveState,
      setLiveState,
      historyConfig,
      setHistoryConfig,
      saveRowsToServer,
      importRowsToDb,
      syncHistorySheet,
      resetDB: resetDBAction,
      handleFileUpload,
      handleHistoryFileUpload,
      handleHistoryDragDrop,
      syncLiveDataNow,
      kpis,
      uniquePOs,
      uniqueStages,
      uniqueTypes,
    }),
    [
      data,
      liveRows,
      lastSync,
      liveConfig,
      liveState,
      historyConfig,
      saveRowsToServer,
      importRowsToDb,
      syncHistorySheet,
      resetDBAction,
      handleFileUpload,
      handleHistoryFileUpload,
      handleHistoryDragDrop,
      syncLiveDataNow,
      kpis,
      uniquePOs,
      uniqueStages,
      uniqueTypes,
    ]
  );

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}
