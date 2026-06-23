import { useMemo } from 'react';

export function useDatabaseKPIs(
  data,
  filtered,
  fromDate,
  toDate,
  dateType,
  allScItemsModal,
  filteredScGroupsModal,
  hasNonDateFilter
) {
  return useMemo(() => {
    const total = filtered.length;

    let totalPOCountSet = new Set();
    const _getScFamily = (sc) => String(sc).trim().replace(/-\d+$/, '');
    const _scFamilySet = new Set();
    const dataBySc = {};

    data.forEach((r) => {
      if (r.po) totalPOCountSet.add(r.po);
      if (r.sc) {
        _scFamilySet.add(_getScFamily(r.sc));
        if (!dataBySc[r.sc]) dataBySc[r.sc] = [];
        dataBySc[r.sc].push(r);
      }
    });

    const totalPOCount = totalPOCountSet.size;
    const totalSCCount = _scFamilySet.size;

    const _isDoneOrVA = (s) => {
      if (!s) return false;
      const t = String(s).trim().toUpperCase().replace(/\s+/g, '');
      return (
        ['READY', 'STORES', 'STORE', 'STOCK', 'EXSTOCK', 'VA'].includes(t) ||
        /^STOCK[K]?$/.test(t) ||
        /^READ{1,2}Y$/.test(t)
      );
    };

    const isDoneStage = (s) => {
      if (!s) return false;
      const t = String(s).trim().toUpperCase().replace(/\s+/g, '');
      if (t === 'READY') return true;
      if (t === 'STORES') return true;
      if (t === 'STOCK') return true;
      if (t === 'EXSTOCK') return true;
      if (t === 'VA') return true; // VA is a terminal stage
      if (/^STOCK{1,2}$/.test(t)) return true;
      if (/^READ{1,2}Y$/.test(t)) return true;
      if (t === 'STORE') return true; // singular alias
      return false;
    };

    // dataBySc already populated in the single data pass

    const _scFinalMap = {};
    Object.entries(dataBySc).forEach(([sc, rows]) => {
      _scFinalMap[sc] = {};
      const normalizedRows = rows; // We skip deep normalization here for perf, assume it's done elsewhere
      normalizedRows.forEach((r) => {
        const pkey = (r.product || '__none__').trim();
        const ex = _scFinalMap[sc][pkey];
        if (!ex) {
          _scFinalMap[sc][pkey] = r;
          return;
        }
        const rDone = _isDoneOrVA(r.currentStage);
        const exDone = _isDoneOrVA(ex.currentStage);
        if (rDone && !exDone) {
          _scFinalMap[sc][pkey] = r;
          return;
        }
        if (!rDone && exDone) return;
        if (r._isLive && !ex._isLive) {
          _scFinalMap[sc][pkey] = r;
          return;
        }
        if (!r._isLive && ex._isLive) return;
        if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) _scFinalMap[sc][pkey] = r;
      });
    });

    const _scStageCounts = { READY: 0, STORES: 0, STOCK: 0, EXSTOCK: 0 };
    Object.values(_scFinalMap).forEach((prodMap) => {
      const latestRows = Object.values(prodMap);
      if (latestRows.length > 0 && latestRows.every((r) => _isDoneOrVA(r.currentStage))) {
        const seenStages = new Set();
        latestRows.forEach((r) => {
          const st = String(r.currentStage || '')
            .trim()
            .toUpperCase();
          const norm =
            st === 'STORE'
              ? 'STORES'
              : /^STOCK[K]?$/.test(st)
                ? 'STOCK'
                : /^READ{1,2}Y$/.test(st)
                  ? 'READY'
                  : st;
          if (_scStageCounts[norm] !== undefined) seenStages.add(norm);
        });
        seenStages.forEach((s) => {
          _scStageCounts[s]++;
        });
      }
    });

    let uniquePOSet = new Set();
    let uniqueSCSet = new Set();
    let readyItemsCount = 0;
    let scReceivedSet = new Set();

    filtered.forEach(r => {
      if (r.po) uniquePOSet.add(r.po);
      if (r.sc) uniqueSCSet.add(r.sc);
      if (isDoneStage(r.currentStage)) readyItemsCount++;
      if (r.poDate && r.sc) scReceivedSet.add(r.sc);
    });

    const uniquePO = uniquePOSet.size;
    const uniqueSC = uniqueSCSet.size;

    const allScItems = allScItemsModal;
    const filteredScGroups = filteredScGroupsModal;

    const getLatestPerProduct = (rows) => {
      const latestMap = {};
      rows.forEach((r) => {
        const key = (r.product || '__none__').trim();
        const ex = latestMap[key];
        if (!ex) {
          latestMap[key] = r;
          return;
        }
        const rDone = isDoneStage(r.currentStage);
        const exDone = isDoneStage(ex.currentStage);
        if (rDone && !exDone) {
          latestMap[key] = r;
          return;
        }
        if (!rDone && exDone) return;
        if (r._isLive && !ex._isLive) {
          latestMap[key] = r;
          return;
        }
        if (!r._isLive && ex._isLive) return;
        if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) latestMap[key] = r;
      });
      return Object.values(latestMap);
    };

    const isDoneOrVAStage = (s) => {
      if (!s) return false;
      const t = String(s).trim().toUpperCase().replace(/\s+/g, '');
      if (t === 'READY') return true;
      if (t === 'STORES') return true;
      if (t === 'STOCK') return true;
      if (t === 'EXSTOCK') return true;
      if (t === 'STORE') return true;
      if (/^STOCK[K]?$/.test(t)) return true;
      if (/^READ{1,2}Y$/.test(t)) return true;
      if (t === 'VA') return true;
      return false;
    };

    const getLatestPerProductForVA = (rows) => {
      const latestMap = {};
      rows.forEach((r) => {
        const key = (r.product || '__none__').trim();
        const ex = latestMap[key];
        if (!ex) {
          latestMap[key] = r;
          return;
        }
        const rDone = isDoneOrVAStage(r.currentStage);
        const exDone = isDoneOrVAStage(ex.currentStage);
        if (rDone && !exDone) {
          latestMap[key] = r;
          return;
        }
        if (!rDone && exDone) return;
        if (r._isLive && !ex._isLive) {
          latestMap[key] = r;
          return;
        }
        if (!r._isLive && ex._isLive) return;
        if (r.timestamp && (!ex.timestamp || r.timestamp > ex.timestamp)) latestMap[key] = r;
      });
      return Object.values(latestMap);
    };

    const scsToCheck = hasNonDateFilter ? Object.keys(filteredScGroups) : Object.keys(allScItems);

    const scCompletedSet = new Set(
      scsToCheck.filter((sc) => {
        const allRowsForSC = allScItems[sc] || [];
        const latestRows = getLatestPerProduct(allRowsForSC);
        return latestRows.length > 0 && latestRows.every((r) => isDoneStage(r.currentStage));
      })
    );
    const scReadySet = scCompletedSet;
    const getScPrefix = (sc) => String(sc).trim().replace(/-\d+$/, '');

    const scSetsReceivedSet = new Set(
      [...scReceivedSet].map((sc) => getScPrefix(sc)).filter(Boolean)
    );

    const allPrefixes = [
      ...new Set(
        data
          .filter((r) => r.sc)
          .map((r) => getScPrefix(r.sc))
          .filter(Boolean)
      ),
    ];
    
    const scSetsCompletedSet = new Set(
      allPrefixes.filter((prefix) => {
        const prefixSCs = Object.keys(allScItems).filter((sc) => getScPrefix(sc) === prefix);
        if (prefixSCs.length === 0) return false;
        return prefixSCs.every((sc) => {
          const latest = getLatestPerProduct(allScItems[sc] || []);
          return latest.length > 0 && latest.every((i) => isDoneStage(i.currentStage));
        });
      })
    );

    const scSetsCompletedTotal = new Set(
      allPrefixes.filter((prefix) => {
        const prefixSCs = Object.keys(allScItems).filter((sc) => getScPrefix(sc) === prefix);
        if (prefixSCs.length === 0) return false;
        return prefixSCs.every((sc) => {
          const latest = getLatestPerProduct(allScItems[sc] || []);
          return latest.length > 0 && latest.every((i) => isDoneStage(i.currentStage));
        });
      })
    );

    const scCompletedPlusVASet = new Set(
      scsToCheck.filter((sc) => {
        const allRowsForSC = allScItems[sc] || [];
        const latestRows = getLatestPerProductForVA(allRowsForSC);
        return latestRows.length > 0 && latestRows.every((r) => isDoneOrVAStage(r.currentStage));
      })
    );

    const scSetsCompletedPlusVASet = new Set(
      allPrefixes.filter((prefix) => {
        const prefixSCs = Object.keys(allScItems).filter((sc) => getScPrefix(sc) === prefix);
        if (prefixSCs.length === 0) return false;
        return prefixSCs.every((sc) => {
          const latest = getLatestPerProductForVA(allScItems[sc] || []);
          return latest.length > 0 && latest.every((i) => isDoneOrVAStage(i.currentStage));
        });
      })
    );

    const vaBreakdown = (() => {
      const counts = { READY: 0, STOCK: 0, STORES: 0, EXSTOCK: 0, VA: 0 };
      scCompletedPlusVASet.forEach((sc) => {
        const allRowsForSC = allScItems[sc] || [];
        const latestRows = getLatestPerProductForVA(allRowsForSC);
        if (latestRows.length > 0 && latestRows.every((r) => isDoneOrVAStage(r.currentStage))) {
          latestRows.forEach((r) => {
            const st = String(r.currentStage || '')
              .trim()
              .toUpperCase();
            if (st === 'READY') counts.READY++;
            else if (st === 'STOCK') counts.STOCK++;
            else if (st === 'EXSTOCK') counts.EXSTOCK++;
            else if (st === 'STORES' || st === 'STORE') counts.STORES++;
            else if (st === 'VA') counts.VA++;
          });
        }
      });
      return counts;
    })();

    return {
      total,
      uniquePO,
      uniqueSC,
      readyItemsCount,
      totalPOCount,
      totalSCCount,
      scStageCounts: _scStageCounts,
      scReceived: scReceivedSet.size,
      scCompleted: scCompletedSet.size,
      scReady: scReadySet.size,
      scSetsReceived: scSetsReceivedSet.size,
      scSetsCompleted: scSetsCompletedSet.size,
      scSetsCompletedTotal: scSetsCompletedTotal.size,
      scCompletedPlusVA: scCompletedPlusVASet.size,
      scSetsCompletedPlusVA: scSetsCompletedPlusVASet.size,
      scCompletedPlusVASet,
      vaBreakdown,
      isDoneStage
    };
  }, [
    filtered,
    data,
    fromDate,
    toDate,
    dateType,
    allScItemsModal,
    filteredScGroupsModal,
    hasNonDateFilter,
  ]);
}
