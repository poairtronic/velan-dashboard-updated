import React from 'react';
import useFilters from '../hooks/useFilters';
import useUploadHandlers from '../hooks/useUploadHandlers';
import useDashboardData from '../hooks/useDashboardData';
import useLiveSync from '../hooks/useLiveSync';
import { apiSaveRows, apiImportRows, apiResetDB, apiFetchData, apiFetchDataUrl } from '../services/api';
import { toIsoDateString } from '../utils/dateUtils';
import { normalizeGoogleSheetsUrl } from '../services/googleSheets';
import { inferType, normalizeInhouse, normalizeTimestamp } from '../services/dataNormalizer';
import { resolveLatestStage } from '../services/stageResolver';
import { workingDaysBetween, daysBetween, calculateProcessCycleTime, isSCComplete, getSCLastTimestamp, TARGET_DAYS, parseDateTime } from '../utils/calculationUtils';
// ─── DASHBOARD CONTEXT & STATE PROVIDER ───────────────────────────────────────

const DashboardContext = React.createContext();

function useDashboard() {
  const context = React.useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}

function DashboardProvider({ children }) {
  const [data, setData] = React.useState([]);
  const [liveRows, setLiveRows] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [lastSync, setLastSync] = React.useState('');
  const [activeNav, setActiveNav] = React.useState('overview');
  const [selectedPONum, setSelectedPONum] = React.useState(null);
  const [serverStatus, setServerStatus] = React.useState('loading');
  const [now] = React.useState(new Date());

  const [theme, setTheme] = React.useState(() => {
    return localStorage.getItem('velan_theme') || 'dark';
  });

  const [adminKey, setAdminKey] = React.useState('');

  React.useEffect(() => {
    localStorage.setItem('velan_theme', theme);
    document.body.setAttribute('data-theme', theme);
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  const toggleTheme = React.useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  // Local state for uploads and background sync configs
  const [uploadStatus, setUploadStatus] = React.useState(null);
  const [liveConfig, setLiveConfig] = React.useState(() => {
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

  const [liveState, setLiveState] = React.useState({ active: false, lastSync: '', lastError: '' });
  const [historyConfig, setHistoryConfig] = React.useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('velan_history_source_v1') || '{}');
      return { url: typeof stored.url === 'string' ? stored.url : '' };
    } catch {
      return { url: '' };
    }
  });
  const [importState, setImportState] = React.useState({ loading: false, lastMsg: '' });

  React.useEffect(() => {
    localStorage.setItem('velan_live_source_v1', JSON.stringify(liveConfig || {}));
  }, [liveConfig]);

  React.useEffect(() => {
    localStorage.setItem('velan_history_source_v1', JSON.stringify(historyConfig || {}));
  }, [historyConfig]);

  // Network actions
  const saveRowsToServer = React.useCallback((rows, syncType = 'Manual Upload', keyOverride = '') => {
    if (!rows || rows.length === 0) return;
    
    const activeKey = keyOverride || adminKey;
    apiSaveRows(rows, syncType, activeKey)
      .then(result => {
        if (result && result.success) {
          if (result.lastSync) setLastSync(result.lastSync);
          return apiFetchData().then(payload => {
            setData(Array.isArray(payload.rows) ? payload.rows : []);
            setLiveRows(Array.isArray(payload.liveRows) ? payload.liveRows : []);
            setUploadStatus({
              type: 'success',
              msg: `✅ Saved ${rows.length} rows to live dashboard`,
              detail: `Live: ${result.liveTotal} rows | DB: ${result.total} rows total (+${result.newRows || 0} new entries added to Database).`,
            });
          });
        }
      })
      .catch(err => {
        if (err.status === 401) {
          const pass = prompt('Authentication Required: Please enter the API Key to save data:');
          if (pass) {
            setAdminKey(pass);
            saveRowsToServer(rows, syncType, pass);
          } else {
            setUploadStatus({
              type: 'error',
              msg: 'Authentication failed',
              detail: 'Invalid or missing API key.',
            });
          }
        } else {
          setUploadStatus({
            type: 'warn',
            msg: '⚠ Backend save failed',
            detail: 'Data is loaded locally, but backend storage is unavailable.',
          });
        }
      });
  }, [adminKey]);

  const importRowsToDb = React.useCallback((rows, keyOverride = '') => {
    if (!rows || rows.length === 0) return;
    setImportState({ loading: true, lastMsg: 'Importing…' });
    
    const activeKey = keyOverride || adminKey;
    apiImportRows(rows, activeKey)
      .then(result => {
        const msg = result.success
          ? '✅ Imported ' + result.imported + ' new rows to DB (' + result.skipped + ' duplicates skipped). Total DB: ' + result.total
          : '❌ Import failed';
        setImportState({ loading: false, lastMsg: msg });
        return apiFetchData().then(payload => {
          setData(Array.isArray(payload.rows) ? payload.rows : []);
        });
      })
      .catch(err => {
        if (err.status === 401) {
          const pass = prompt('Authentication Required: Please enter the API Key to import data:');
          if (pass) {
            setAdminKey(pass);
            importRowsToDb(rows, pass);
          } else {
            setImportState({ loading: false, lastMsg: '❌ Authentication failed: Invalid or missing API key.' });
          }
        } else {
          setImportState({ loading: false, lastMsg: '❌ ' + String(err.message || err) });
        }
      });
  }, [adminKey]);

  const syncHistorySheet = React.useCallback(async () => {
    const url = String(historyConfig.url || '').trim();
    if (!url) {
      setImportState({ loading: false, lastMsg: '❌ No backup sheet URL set.' });
      return;
    }
    setImportState({ loading: true, lastMsg: 'Fetching backup data from Google Sheet…' });
    try {
      const rawRows = await apiFetchDataUrl(url);
      if (!rawRows || rawRows.length === 0) {
        setImportState({ loading: false, lastMsg: '❌ No rows found in backup sheet.' });
        return;
      }
      const normalized = rawRows.map(raw => {
        const product = String(raw.product || raw['Product Name'] || '').trim();
        const status1 = String(raw.status1 || '').trim();
        const status2 = String(raw.status2 || '').trim();
        const opStage = String(raw.currentStage || '').trim();
        const poRaw   = String(raw.po || '').trim();
        const poDate  = toIsoDateString(raw.poDate);
        const po      = toIsoDateString(poRaw) ? '' : poRaw;
        return {
          ...raw,
          sc: String(raw.sc || '').replace(/\s+/g,'').trim(),
          po, poDate, product,
          type: String(raw.type || '').trim().toUpperCase() || inferType(product),
          status1, status2,
          inhouse: normalizeInhouse(raw.inhouse),
          currentStage: resolveLatestStage({ opStage, status1, status2 }),
          timestamp: normalizeTimestamp(raw.timestamp),
        };
      }).filter(r => r.sc || r.po);
      importRowsToDb(normalized);
    } catch (err) {
      setImportState({ loading: false, lastMsg: '❌ Fetch error: ' + String(err) });
    }
  }, [historyConfig.url, importRowsToDb]);

  const resetDB = React.useCallback(async (keyOverride = '') => {
    if (!window.confirm('⚠️ DANGER: This will permanently DELETE ALL rows from the Neon database.\n\nThis CANNOT be undone.\n\nClick OK only if you want to clear history and start fresh.')) return;
    setImportState({ loading: true, lastMsg: '⏳ Clearing database…' });
    
    const activeKey = keyOverride || adminKey;
    try {
      const json = await apiResetDB(activeKey);
      if (json.success) {
        setData([]);
        setImportState({ loading: false, lastMsg: '✅ Database cleared. All history rows deleted. Re-import your 2K dataset using History Import above.' });
      } else {
        setImportState({ loading: false, lastMsg: '❌ Reset failed: ' + (json.error || 'Unknown error') });
      }
    } catch (err) {
      if (err.status === 401) {
        const pass = prompt('Authentication Required: Please enter the API Key to clear the database:');
        if (pass) {
          setAdminKey(pass);
          setImportState({ loading: false, lastMsg: '' });
          resetDB(pass);
        } else {
          setImportState({ loading: false, lastMsg: '❌ Authentication failed: Invalid or missing API key.' });
        }
      } else {
        setImportState({ loading: false, lastMsg: '❌ Reset error: ' + String(err) });
      }
    }
  }, [adminKey]);

  // Filter hooks
  const filterManager = useFilters();
  const { filters, setFilters, dateRange, setDateRange, resetFilters, filterRows } = filterManager;

  // Upload handlers hook
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

  // Sync Google sheets function
  const syncLiveDataNow = React.useCallback(async (urlOverride) => {
    const sourceUrl = String(urlOverride || liveConfig.url || '').trim();
    if (!sourceUrl) {
      setUploadStatus({
        type: 'error',
        msg: 'Live source URL is empty.',
        detail: 'Paste your Google Sheets URL (share link, edit link, or CSV export link).',
      });
      return;
    }

    const normalized = normalizeGoogleSheetsUrl(sourceUrl);
    const isGSheets  = normalized.includes('docs.google.com/spreadsheets');
    setUploadStatus({
      type: 'loading',
      msg: '🔄 Syncing live source…',
      detail: isGSheets ? `Google Sheets → CSV export → ${normalized.substring(0, 60)}…` : sourceUrl,
    });

    try {
      const rows = await apiFetchDataUrl(sourceUrl);
      
      // inline finalize helper using state updates
      if (!rows || rows.length === 0) {
        setUploadStatus({
          type: 'error',
          msg: 'No valid rows found in file.',
          detail: 'Check that the file has data and correct column names.',
        });
        return;
      }
      const normalizedRows = rows.map(raw => {
        const product = String(raw.product || raw['Product Name'] || '').trim();
        const status1 = String(raw.status1 || '').trim();
        const status2 = String(raw.status2 || '').trim();
        const opStage = String(raw.currentStage || '').trim();
        const poRaw = String(raw.po || '').trim();
        const poDate = toIsoDateString(raw.poDate);
        const po = toIsoDateString(poRaw) ? '' : poRaw;
        return {
          ...raw,
          sc: String(raw.sc || '').replace(/\s+/g,'').trim(),
          po,
          poDate,
          product,
          type: String(raw.type || '').trim().toUpperCase() || inferType(product),
          status1,
          status2,
          inhouse: normalizeInhouse(raw.inhouse),
          currentStage: resolveLatestStage({ opStage, status1, status2 }),
          timestamp: normalizeTimestamp(raw.timestamp),
        };
      }).filter(r => r.sc || r.po);

      const missingStage = normalizedRows.filter(r => !r.currentStage).length;
      setLiveRows(normalizedRows);
      saveRowsToServer(normalizedRows, 'Google Sheets Sync');

      const sourceName = isGSheets ? 'GOOGLE SHEETS (LIVE)' : 'LIVE SOURCE';
      setUploadStatus({
        type: 'success',
        msg: `✅ ${normalizedRows.length} rows loaded from "${sourceName}" — live latest status resolved`,
        detail: missingStage > 0 ? `⚠ ${missingStage} rows have no stage value` : null,
      });

      setLiveState({ active: true, lastSync: new Date().toLocaleString('en-IN'), lastError: '' });
    } catch (err) {
      setLiveState(prev => ({ ...prev, active: false, lastError: String(err) }));
      setUploadStatus({
        type: 'error',
        msg: 'Live sync failed.',
        detail: `${String(err)}\n\n💡 For Google Sheets: File → Share → Publish to web → Entire Document → CSV → Publish\n   Copy the /pub?output=csv link and paste it above.`,
      });
    }
  }, [liveConfig.url, saveRowsToServer]);

  // Initialize data loading hook
  useDashboardData({
    setData,
    setLiveRows,
    setLastSync,
    setServerStatus,
    setIsLoading,
    setLiveConfig,
    setHistoryConfig,
  });

  // Background Live Poll Sync hook
  useLiveSync(liveConfig, syncLiveDataNow);

  // ── FILTERED DATA ──────────────────────────────────────────────────────────
  const processedData = React.useMemo(() => {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    return data.map(row => ({
      ...row,
      pendingDays: row.timestamp ? workingDaysBetween(row.timestamp, todayStr) : null,
      cycleTime: (row.timestamp && row.poDate) ? workingDaysBetween(row.poDate, row.timestamp) : null,
    }));
  }, [data, now]);

  const allDbData = React.useMemo(() => {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
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
  }, [processedData, liveRows, now]);

  const liveData = React.useMemo(() => {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    return liveRows.map(row => ({
      ...row,
      pendingDays: row.timestamp ? workingDaysBetween(row.timestamp, todayStr) : null,
      cycleTime: (row.timestamp && row.poDate) ? workingDaysBetween(row.poDate, row.timestamp) : null,
    }));
  }, [liveRows, now]);

  const filtered = React.useMemo(() => {
    return filterRows(liveData);
  }, [liveData, filterRows]);

  const scGroups = React.useMemo(() => {
    const g = {};
    liveData.forEach(row => {
      if (!g[row.sc]) g[row.sc] = { sc: row.sc, po: row.po, poDate: row.poDate, _all: [] };
      g[row.sc]._all.push(row);
    });
    return Object.values(g).map(sg => {
      const latestMap = {};
      sg._all.forEach(r => {
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

  const poGroups = React.useMemo(() => {
    const g = {};
    liveData.forEach(row => {
      if (!g[row.po]) g[row.po] = { po: row.po, poDate: row.poDate, items: [] };
      g[row.po].items.push(row);
    });
    return Object.values(g);
  }, [liveData]);

  // ── KPI CALCULATIONS ───────────────────────────────────────────────────────
  const kpiStats = React.useMemo(() => {
    const totalItems = filtered.length;

    const filteredScGroupsMap = {};
    filtered.forEach(row => {
      if (!row.sc) return;
      if (!filteredScGroupsMap[row.sc]) {
        filteredScGroupsMap[row.sc] = { sc: row.sc, po: row.po, poDate: row.poDate, items: [] };
      }
      filteredScGroupsMap[row.sc].items.push(row);
    });
    const filteredScGroups = Object.values(filteredScGroupsMap);

    const readySets = filteredScGroups.filter(sg =>
      sg.items.every(i => i.currentStage === 'READY')
    );
    const ready = readySets.length;

    const storeSets = filteredScGroups.filter(sg =>
      sg.items.every(i => i.currentStage === 'STORES')
    );
    const stores = storeSets.length;

    const wip = filtered.filter(r => !['READY','STORES','STOCK','EXSTOCK'].includes(r.currentStage)).length;
    const inhouse = filtered.filter(r => r.inhouse === 'INHOUSE').length;
    const vendor = filtered.filter(r => r.inhouse === 'VENDOR').length;

    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    let onTime = 0, delayed = 0, onTimePOs = [], delayedPOs = [], completedPOCount = 0;
    poGroups.forEach(pg => {
      const lastTs = getSCLastTimestamp(pg.items);
      const allDone = pg.items.every(i => ['READY','STORES','STOCK','EXSTOCK'].includes(i.currentStage));
      if (allDone) {
        completedPOCount++;
        const days = daysBetween(pg.poDate, lastTs);
        if (days !== null && days <= TARGET_DAYS) {
          onTime++;
          onTimePOs.push({ ...pg, days });
        } else {
          delayed++;
          delayedPOs.push({ ...pg, days });
        }
      } else {
        const elapsed = daysBetween(pg.poDate, today);
        if (elapsed !== null && elapsed > TARGET_DAYS) {
          delayed++;
          delayedPOs.push({ ...pg, days: elapsed, inProgress: true });
        }
      }
    });
    const totalPOs = poGroups.length;
    const onTimePct = completedPOCount > 0 ? Math.round(onTime / completedPOCount * 100) : 0;

    const stageWIP = {};
    filtered.forEach(row => {
      const stage = row.currentStage;
      if (!stageWIP[stage]) stageWIP[stage] = 0;
      stageWIP[stage]++;
    });

    const stageCounts = {};
    filtered.forEach(r => {
      stageCounts[r.currentStage] = (stageCounts[r.currentStage] || 0) + 1;
    });

    const bottleneck = [...poGroups].map(pg => {
      const lastTs = getSCLastTimestamp(pg.items);
      const done = pg.items.every(i => ['READY','STORES','STOCK','EXSTOCK'].includes(i.currentStage));
      const days = done ? daysBetween(pg.poDate, lastTs) : daysBetween(pg.poDate, today);
      return { ...pg, days, done };
    }).sort((a, b) => (b.days || 0) - (a.days || 0));

    const dateDiff = (poDate, tsStr) => {
      if (!poDate || !tsStr) return null;
      const d = workingDaysBetween(poDate, tsStr);
      return (d !== null && d >= 0) ? d : null;
    };

    const dailyOutput = {};
    filtered.forEach(row => {
      if (!row.timestamp) return;
      const date = row.timestamp.substring(0, 10);
      if (!dailyOutput[date]) dailyOutput[date] = { date, ready: 0, stores: 0 };
      if (row.currentStage === 'READY') dailyOutput[date].ready++;
      if (row.currentStage === 'STORES') dailyOutput[date].stores++;
    });
    const dailyOutputArray = Object.values(dailyOutput).sort((a, b) => a.date > b.date ? 1 : -1);

    const scByDate = {};
    scGroups.forEach(sg => {
      const done = isSCComplete(sg.items);
      const lastTs = getSCLastTimestamp(sg.items);
      if (!lastTs) return;
      const d = lastTs.substring(0, 10);
      if (!scByDate[d]) scByDate[d] = { date: d, readySets: 0, storeSets: 0 };
      if (done) {
        const hasStores = sg.items.some(i => i.currentStage === 'STORES');
        if (hasStores) scByDate[d].storeSets++;
        else scByDate[d].readySets++;
      }
    });
    const scDailyOutput = Object.values(scByDate).sort((a, b) => a.date > b.date ? 1 : -1);

    const completeSets = filteredScGroups.filter(sg =>
      sg.items.every(i => ['READY','STORES','STOCK','EXSTOCK'].includes(i.currentStage))
    );

    const STAGE_ORDER = ['RM','LATHE','M1','FB','HT','SZ','BLK','CG','SG','SD','HO','CA','WC','VA','QC','DCPLI','STORES','READY',
                         'FBV','BLV','SDV','HOV','HTV','HCV'];

    const scRecordMap = {};
    filtered.forEach(r => {
      if (!r.sc) return;
      if (!scRecordMap[r.sc]) scRecordMap[r.sc] = [];
      scRecordMap[r.sc].push(r);
    });

    const stageDurations = {};
    Object.values(scRecordMap).forEach(records => {
      const sorted = records.sort((a, b) => {
        const tA = parseDateTime(a.timestamp) || new Date(0);
        const tB = parseDateTime(b.timestamp) || new Date(0);
        return tA - tB;
      });

      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (!current.currentStage || !current.timestamp || !next.timestamp) continue;
        const daysDiff = workingDaysBetween(
          current.timestamp.substring(0, 10),
          next.timestamp.substring(0, 10)
        );
        if (daysDiff >= 0) {
          const stage = current.currentStage;
          if (!stageDurations[stage]) stageDurations[stage] = [];
          stageDurations[stage].push(daysDiff);
        }
      }
    });

    const stageAvgDuration = {};
    Object.entries(stageDurations).forEach(([stage, durations]) => {
      const avg = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
      stageAvgDuration[stage] = Math.round(avg);
    });

    const stageAccum = {};
    filtered.forEach(r => {
      if (!r.timestamp || !r.poDate || !r.currentStage) return;
      const days = dateDiff(r.poDate, r.timestamp);
      if (days === null) return;
      if (!stageAccum[r.currentStage]) stageAccum[r.currentStage] = [];
      stageAccum[r.currentStage].push(days);
    });

    const stageAvgToReach = {};
    Object.entries(stageAccum).forEach(([stage, vals]) => {
      stageAvgToReach[stage] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    });

    const stageCycleTimes = Object.entries(stageAvgDuration).map(([stage, duration]) => {
      const avgToReach = stageAvgToReach[stage] || 0;
      const count = stageDurations[stage] ? stageDurations[stage].length : 0;
      return { stage, avgToReach, duration, count };
    })
    .filter(s => s.count > 0)
    .sort((a, b) => a.avgToReach - b.avgToReach);

    const itemCycleDays = filtered
      .map(r => dateDiff(r.poDate, r.timestamp))
      .filter(d => d !== null && d >= 0);
    const avgOverallCycle = itemCycleDays.length > 0
      ? Math.round(itemCycleDays.reduce((a, b) => a + b, 0) / itemCycleDays.length)
      : null;

    const bottleneckStages = Object.entries(stageCounts)
      .filter(([s]) => !['READY','STORES','STOCK','EXSTOCK'].includes(s))
      .map(([stage, count]) => {
        const ct = stageCycleTimes.find(c => c.stage === stage);
        const duration = ct ? ct.duration : 1;
        const score = count * duration;
        return { stage, count, duration, score };
      })
      .sort((a, b) => b.score - a.score);

    const vendorStageData = [];
    filtered.forEach(r => {
      if (r.inhouse !== 'VENDOR' || !r.timestamp) return;
      const daysFromPO = r.poDate ? dateDiff(r.poDate, r.timestamp) : null;
      const pendingDays = dateDiff(r.timestamp, today);
      if (pendingDays !== null) vendorStageData.push({
        vendor: r.currentStage || 'UNKNOWN',
        stage: r.currentStage,
        daysFromPO,
        pendingDays,
        po: r.po,
        sc: r.sc,
        product: r.product,
        timestamp: r.timestamp,
      });
    });

    const vendorStats = {};
    vendorStageData.forEach(s => {
      if (!vendorStats[s.vendor]) {
        vendorStats[s.vendor] = {
          vendor: s.vendor,
          totalPending: 0, count: 0, pendingDays: [],
          totalFromPO: 0, fromPODays: [], items: [],
        };
      }
      vendorStats[s.vendor].totalPending += s.pendingDays;
      vendorStats[s.vendor].count++;
      vendorStats[s.vendor].pendingDays.push(s.pendingDays);
      if (s.daysFromPO !== null) {
        vendorStats[s.vendor].totalFromPO += s.daysFromPO;
        vendorStats[s.vendor].fromPODays.push(s.daysFromPO);
      }
      vendorStats[s.vendor].items.push(s);
    });

    Object.keys(vendorStats).forEach(v => {
      const stats = vendorStats[v];
      stats.avgPending = stats.count > 0 ? Math.round(stats.totalPending / stats.count) : 0;
      stats.maxPending = stats.pendingDays.length > 0 ? Math.max(...stats.pendingDays) : 0;
      stats.minPending = stats.pendingDays.length > 0 ? Math.min(...stats.pendingDays) : 0;
      stats.stale = stats.pendingDays.filter(d => d > TARGET_DAYS).length;
      stats.avgFromPO = stats.fromPODays.length > 0 ? Math.round(stats.totalFromPO / stats.fromPODays.length) : null;

      stats.slaViolations = stats.pendingDays.filter(d => d > 2).length;
      stats.slaViolationRate = stats.count > 0 ? Math.round((stats.slaViolations / stats.count) * 100) : 0;

      const completedItems = stats.items.filter(i => ['READY','STORES','STOCK','EXSTOCK'].includes(i.stage)).length;
      stats.processEfficiency = stats.count > 0 ? Math.round((completedItems / stats.count) * 100) : 0;

      stats.avgActiveTime = stats.avgPending;
    });

    const vendorBottlenecks = Object.values(vendorStats)
      .map(v => ({
        vendor: v.vendor,
        count: v.count,
        avgPending: v.avgPending,
        maxPending: v.maxPending,
        slaViolations: v.slaViolations,
        efficiency: v.processEfficiency,
      }))
      .sort((a, b) =>
        b.slaViolations - a.slaViolations ||
        b.avgPending    - a.avgPending    ||
        b.count         - a.count
      );

    const topVendorBottleneck = vendorBottlenecks[0] || null;

    {
      const vendorAvgPendingMap = {};
      Object.values(vendorStats).forEach(s => {
        if (s && s.vendor) vendorAvgPendingMap[s.vendor] = s.avgPending || 0;
      });
      const corrected = Object.entries(stageCounts)
        .filter(([s]) => !['READY','STORES','STOCK','EXSTOCK'].includes(s))
        .map(([stage, count]) => {
          let duration;
          if (vendorAvgPendingMap[stage] !== undefined) {
            duration = vendorAvgPendingMap[stage] || 1;
          } else {
            const ct = stageCycleTimes.find(c => c.stage === stage);
            duration = ct ? ct.duration : 1;
          }
          return { stage, count, duration, score: count * duration };
        })
        .sort((a, b) => b.score - a.score);
      bottleneckStages.length = 0;
      corrected.forEach(s => bottleneckStages.push(s));
    }
    const topBottleneckCorrected = bottleneckStages[0] || null;

    const vendorTimeMap = {};
    filtered.forEach(r => {
      if (r.inhouse !== 'VENDOR') return;
      const vcode = r.currentStage || 'UNKNOWN';
      if (!vendorTimeMap[vcode]) vendorTimeMap[vcode] = { code: vcode, count: 0, items: [], days: [] };
      vendorTimeMap[vcode].count++;
      vendorTimeMap[vcode].items.push(r);
      const d = dateDiff(r.timestamp, today);
      if (d !== null) vendorTimeMap[vcode].days.push(d);
    });
    const vendorTotal = Object.values(vendorTimeMap).reduce((s, v) => s + v.count, 0);
    const vendors = Object.values(vendorTimeMap)
      .sort((a, b) => b.count - a.count)
      .map(v => {
        const avgDays = v.days.length > 0 ? Math.round(v.days.reduce((a, b) => a + b, 0) / v.days.length) : null;
        const maxDays = v.days.length > 0 ? Math.max(...v.days) : null;
        const delayed = v.items.filter(i => {
          const d = dateDiff(i.timestamp, today);
          return d !== null && d > TARGET_DAYS;
        }).length;
        const stats = vendorStats[v.code] || {};
        return {
          ...v,
          pct: Math.round(v.count / Math.max(vendorTotal, 1) * 100),
          avgDays,
          maxDays,
          delayed,
          avgFromPO: stats.avgFromPO || null,
          slaViolations: stats.slaViolations || 0,
          slaViolationRate: stats.slaViolationRate || 0,
          processEfficiency: stats.processEfficiency || 0,
          avgActiveTime: stats.avgActiveTime || 0,
        };
      });

    const scCompletion = scGroups.map(sg => {
      const done = isSCComplete(sg.items);
      const lastTs = getSCLastTimestamp(sg.items);
      const days = dateDiff(sg.poDate, lastTs);
      return { ...sg, done, lastTs, days };
    });

    return {
      totalItems, ready, stores, wip, inhouse, vendor,
      onTime, delayed, onTimePct, totalPOs,
      stageCounts, stageWIP, bottleneck, bottleneckStages, topBottleneck: topBottleneckCorrected,
      vendors, vendorTotal, vendorStats, topVendorBottleneck,
      stageCycleTimes, stageAvgToReach, avgOverallCycle,
      scCompletion, scDailyOutput,
      completeSets, storeSets, readySets,
      delayedPOs, onTimePOs,
      dailyOutput, dailyOutputArray,
    };
  }, [filtered, scGroups, poGroups, liveData, now]);

  const uniquePOs     = React.useMemo(() => [...new Set(liveData.map(r => r.po))].sort(), [liveData]);
  const uniqueStages  = React.useMemo(() => [...new Set(liveData.map(r => r.currentStage))].filter(Boolean).sort(), [liveData]);
  const uniqueTypes   = React.useMemo(() => [...new Set(liveData.map(r => r.type))].filter(Boolean).sort(), [liveData]);

  // Context value object containing all shared variables
  const contextValue = {
    data, setData,
    liveRows, setLiveRows,
    isLoading, setIsLoading,
    lastSync, setLastSync,
    activeNav, setActiveNav,
    selectedPONum, setSelectedPONum,
    filters, setFilters,
    dateRange, setDateRange,
    serverStatus, setServerStatus,
    now,
    uploadStatus, setUploadStatus,
    liveConfig, setLiveConfig,
    liveState, setLiveState,
    historyConfig, setHistoryConfig,
    importState, setImportState,
    saveRowsToServer,
    importRowsToDb,
    syncHistorySheet,
    resetDB,
    resetFilters,
    handleFileUpload,
    handleHistoryFileUpload,
    handleHistoryDragDrop,
    syncLiveDataNow,
    processedData,
    allDbData,
    liveData,
    filtered,
    scGroups,
    poGroups,
    kpis: kpiStats,
    uniquePOs,
    uniqueStages,
    uniqueTypes,
    theme,
    toggleTheme,
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}

export { DashboardContext, useDashboard, DashboardProvider };