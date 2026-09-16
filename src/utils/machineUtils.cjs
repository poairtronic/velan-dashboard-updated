// ─── STAGE TO MACHINE MAPPING FOR VELAN OPERATIONS (CommonJS) ───────────────

const STAGE_MACHINE_MAP = {
  'LATHE-BORE': 'CON LATHE',
  'LATHE-FB': 'GEE DEE WEILER',
  'LATHE-ID': 'CON LATHE',
  'LATHE-TAP': 'CON LATHE',
  'M1-AES': 'M1TR',
  'M1-DC': 'M1TR',
  'M1-JH': 'M1TR',
  'M1-QC': 'M1TR',
  'M1-WR': 'M1TR',
  'CG-OD(APG)': 'CG-MANIKAM',
  'CG-OD(SETTING DISC)': 'CG-MANIKAM',
  'CG-OD(SETTING PLUG)': 'CG-MANIKAM',
  'CG-ID(SETTING RING BELOW 20)': 'CG-SRINI',
  'CG-ID(AIR RING BELOW 20)': 'CG-SRINI',
  'CG-IDJR': 'CG-SRINI',
  'CG-IDSU': 'CG-SRINI',
  'CG-JC': 'CG-MANIKKAM',
  'CG-REFOD': 'CG-MANIKKAM',
  'CG-ODJR': 'CG-SRINI',
  'CG-ODSU': 'CG-MANIKKAM',
  'SG-JR/AE': 'SG-ARUL',
};

const ALL_MACHINES = [
  'CON LATHE',
  'GEE DEE WEILER',
  'M1TR',
  'CG-MANIKAM',
  'CG-MANIKKAM',
  'CG-SRINI',
  'SG-ARUL',
];

const normKey = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/[\s\-_/()]+/g, '');

const NORMALIZED_MAP = new Map();
Object.entries(STAGE_MACHINE_MAP).forEach(([stage, machine]) => {
  NORMALIZED_MAP.set(normKey(stage), machine);
});

function getMachineForStage(stage) {
  if (!stage) return '';
  const trimmed = String(stage).trim().toUpperCase();
  if (STAGE_MACHINE_MAP[trimmed]) return STAGE_MACHINE_MAP[trimmed];

  const clean = normKey(trimmed);
  if (NORMALIZED_MAP.has(clean)) return NORMALIZED_MAP.get(clean);

  for (const [key, machine] of Object.entries(STAGE_MACHINE_MAP)) {
    const normK = normKey(key);
    if (clean.includes(normK)) return machine;
  }

  return '';
}

function getMachineForRow(row) {
  if (!row) return '';
  if (row.machine && ALL_MACHINES.includes(row.machine)) return row.machine;
  return (
    getMachineForStage(row.currentStage) ||
    getMachineForStage(row.status1) ||
    getMachineForStage(row.status2) ||
    ''
  );
}

module.exports = {
  STAGE_MACHINE_MAP,
  ALL_MACHINES,
  getMachineForStage,
  getMachineForRow,
};
