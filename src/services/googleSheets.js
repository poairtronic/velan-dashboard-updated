// ─── GOOGLE SHEETS SERVICES ──────────────────────────────────────────────────

function normalizeGoogleSheetsUrl(rawUrl) {
  // Convert any Google Sheets share/edit URL -> CSV export URL
  // Handles: /edit, /view, /pub, already-CSV, already-export URLs, and /d/e/ publish URLs
  try {
    const u = rawUrl.trim();
    // Already a CSV export: leave alone
    if (/docs\.google\.com\/spreadsheets\/d\/.+\/export/.test(u) && /format=csv/.test(u)) return u;
    // Published CSV (including /d/e/ format): leave alone — pass directly to proxy
    if (/docs\.google\.com\/spreadsheets\/d\/e\/.+\/pub/.test(u) && /output=csv/.test(u)) return u;
    if (/docs\.google\.com\/spreadsheets\/d\/.+\/pub/.test(u) && /output=csv/.test(u)) return u;
    // Extract spreadsheet ID — skip /d/e/ publish paths (can't convert, leave as-is)
    if (/\/spreadsheets\/d\/e\//.test(u)) return u;
    const idMatch = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!idMatch) return u; // not a Sheets URL — return as-is
    const sheetId = idMatch[1];
    // Extract gid if present (specific sheet tab)
    const gidMatch = u.match(/[?&]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : '0';
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  } catch {
    return rawUrl;
  }
}

export { normalizeGoogleSheetsUrl };
