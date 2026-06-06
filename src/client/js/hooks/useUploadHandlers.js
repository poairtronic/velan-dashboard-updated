// ─── FILE UPLOAD HANDLERS HOOK ───────────────────────────────────────────────

function useUploadHandlers(options) {
  const {
    setLiveRows,
    setData,
    setLastSync,
    setUploadStatus,
    setImportState,
    saveRowsToServer,
    importRowsToDb,
  } = options;

  // Finalize parsed rows from client uploads (saves live Operational rows)
  const finalizeRows = React.useCallback((rows, sourceName) => {
    if (!rows || rows.length === 0) {
      setUploadStatus({
        type: 'error',
        msg: 'No valid rows found in file.',
        detail: 'Check that the file has data and correct column names.',
      });
      return false;
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
    saveRowsToServer(normalizedRows, 'Manual Upload');

    setUploadStatus({
      type: 'success',
      msg: `✅ ${normalizedRows.length} rows loaded from "${sourceName}" — live latest status resolved`,
      detail: missingStage > 0 ? `⚠ ${missingStage} rows have no stage value` : null,
    });
    return true;
  }, [setLiveRows, saveRowsToServer, setUploadStatus]);

  // Main uploader for current active production operational files (Upload Page)
  const handleFileUpload = React.useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    setUploadStatus({ type: 'loading', msg: `⏳ Reading "${file.name}"…` });

    if (ext === 'json') {
      reader.onload = e => {
        try {
          const parsed = JSON.parse(e.target.result);
          const rows = Array.isArray(parsed) ? parsed : [parsed];
          rows.forEach(r => { if (!r.type) r.type = inferType(r.product || r['Product Name'] || ''); });
          finalizeRows(rows, file.name);
        } catch (err) {
          setUploadStatus({ type: 'error', msg: 'Invalid JSON.', detail: String(err) });
        }
      };
      reader.readAsText(file);
    } else if (['xlsx', 'xls'].includes(ext)) {
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true, raw: false });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const parsedRows = parseWorksheet(ws);
          finalizeRows(parsedRows, file.name);
        } catch (err) {
          setUploadStatus({ type: 'error', msg: 'Failed to read Excel.', detail: String(err) });
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'csv') {
      reader.onload = e => {
        try {
          const rawAoA = parseRawCsv(e.target.result);
          const rows   = parseRowsFromHeaderAoA(rawAoA);
          finalizeRows(rows, file.name);
        } catch (err) {
          setUploadStatus({ type: 'error', msg: 'Failed to parse CSV.', detail: String(err) });
        }
      };
      reader.readAsText(file);
    } else {
      setUploadStatus({
        type: 'error',
        msg: `Unsupported file type: .${ext}`,
        detail: 'Supported: .xlsx, .xls, .csv, .json',
      });
    }
  }, [finalizeRows, setUploadStatus]);

  // History / Database backup uploader (Database Page)
  const handleHistoryFileUpload = React.useCallback((file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    setImportState({ loading: true, lastMsg: `⏳ Reading "${file.name}"…` });

    const processRows = (rows) => {
      if (!rows || rows.length === 0) {
        setImportState({ loading: false, lastMsg: '❌ No valid rows found in file.' });
        return;
      }
      const normalized = rows.map(raw => {
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
    };

    if (ext === 'json') {
      reader.onload = e => {
        try {
          const parsed = JSON.parse(e.target.result);
          const rows = Array.isArray(parsed) ? parsed : [parsed];
          rows.forEach(r => { if (!r.type) r.type = inferType(r.product || r['Product Name'] || ''); });
          processRows(rows);
        } catch (err) {
          setImportState({ loading: false, lastMsg: '❌ Invalid JSON: ' + String(err) });
        }
      };
      reader.readAsText(file);
    } else if (['xlsx', 'xls'].includes(ext)) {
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true, raw: false });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const parsedRows = parseWorksheet(ws);
          processRows(parsedRows);
        } catch (err) {
          setImportState({ loading: false, lastMsg: '❌ Failed to read Excel: ' + String(err) });
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'csv') {
      reader.onload = e => {
        try {
          const rawAoA = parseRawCsv(e.target.result);
          const rows = parseRowsFromHeaderAoA(rawAoA);
          processRows(rows);
        } catch (err) {
          setImportState({ loading: false, lastMsg: '❌ Failed to parse CSV: ' + String(err) });
        }
      };
      reader.readAsText(file);
    } else {
      setImportState({ loading: false, lastMsg: `❌ Unsupported: .${ext} (Use .xlsx, .xls, .csv, .json)` });
    }
  }, [importRowsToDb, setImportState]);

  const handleHistoryDragDrop = React.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleHistoryFileUpload(files[0]);
    }
  }, [handleHistoryFileUpload]);

  return {
    handleFileUpload,
    handleHistoryFileUpload,
    handleHistoryDragDrop,
  };
}
