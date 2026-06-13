import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useUI } from './UIContext';
import { saveRows, importRows, resetDB } from '../services/dataService';
import { fetchDataUrl } from '../services/sheetsService';
import { normalizeRow } from '../utils/normalizeRow';
import useLiveSync from '../hooks/useLiveSync';
import useUploadHandlers from '../hooks/useUploadHandlers';
import { normalizeGoogleSheetsUrl } from '../services/googleSheets';
import { toast } from 'react-hot-toast';
import { logger } from '../utils/logger';

const DataContext = createContext();

export function DataProvider({ children }) {
  const { user, isAdmin } = useAuth();
  const {
    setServerStatus,
    setIsLoading,
    setUploadStatus,
    setImportState,
    liveState,
    setLiveState,
  } = useUI();

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

  const queryClient = useQueryClient();

  const saveRowsMutation = useMutation({
    mutationFn: ({ rows, syncType }) => saveRows(rows, syncType),
    onSuccess: (result, variables) => {
      if (result && result.success) {
        if (result.lastSync) setLastSync(result.lastSync);
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['kpis'] });
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
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
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
        setImportState({
          loading: false,
          lastMsg:
            '✅ Database cleared. All history rows deleted. Re-import your dataset using History Import above.',
        });
        toast.success('Database cleared.');
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['kpis'] });
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
    setLiveRows: () => {}, // No longer needed
    setData: () => {},     // No longer needed
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

  const contextValue = useMemo(
    () => ({
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
    }),
    [
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
    ]
  );

  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}
