import { describe, it, expect } from 'vitest';
import {
  STAGE_MACHINE_MAP,
  ALL_MACHINES,
  getMachineForStage,
  getMachineForRow,
} from '../../utils/machineUtils';

describe('machineUtils - Stage to Machine Mapping', () => {
  it('should map Lathe operations accurately to their assigned machines', () => {
    expect(getMachineForStage('LATHE-BORE')).toBe('CON LATHE');
    expect(getMachineForStage('lathe-bore')).toBe('CON LATHE');
    expect(getMachineForStage('LATHE BORE')).toBe('CON LATHE');
    expect(getMachineForStage('LATHE-FB')).toBe('GEE DEE WEILER');
    expect(getMachineForStage('LATHE-ID')).toBe('CON LATHE');
    expect(getMachineForStage('LATHE-TAP')).toBe('CON LATHE');
  });

  it('should map M1 operations to M1TR', () => {
    expect(getMachineForStage('M1-AES')).toBe('M1TR');
    expect(getMachineForStage('M1-DC')).toBe('M1TR');
    expect(getMachineForStage('M1-JH')).toBe('M1TR');
    expect(getMachineForStage('M1-QC')).toBe('M1TR');
    expect(getMachineForStage('M1-WR')).toBe('M1TR');
  });

  it('should map CG and SG operations to their respective machines', () => {
    expect(getMachineForStage('CG-OD(APG)')).toBe('CG-MANIKAM');
    expect(getMachineForStage('CG-OD(SETTING DISC)')).toBe('CG-MANIKAM');
    expect(getMachineForStage('CG-OD(SETTING PLUG)')).toBe('CG-MANIKAM');
    expect(getMachineForStage('CG-ID(SETTING RING BELOW 20)')).toBe('CG-SRINI');
    expect(getMachineForStage('CG-ID(AIR RING BELOW 20)')).toBe('CG-SRINI');
    expect(getMachineForStage('CG-IDJR')).toBe('CG-SRINI');
    expect(getMachineForStage('CG-IDSU')).toBe('CG-SRINI');
    expect(getMachineForStage('CG-JC')).toBe('CG-MANIKKAM');
    expect(getMachineForStage('CG-REFOD')).toBe('CG-MANIKKAM');
    expect(getMachineForStage('CG-ODJR')).toBe('CG-SRINI');
    expect(getMachineForStage('CG-ODSU')).toBe('CG-MANIKKAM');
    expect(getMachineForStage('SG-JR/AE')).toBe('SG-ARUL');
  });

  it('should return empty string for operations without machines', () => {
    expect(getMachineForStage('VA')).toBe('');
    expect(getMachineForStage('HEAT TREATMENT')).toBe('');
    expect(getMachineForStage('')).toBe('');
    expect(getMachineForStage(null)).toBe('');
    expect(getMachineForStage(undefined)).toBe('');
  });

  it('should resolve machine for production rows via getMachineForRow', () => {
    const row1 = { currentStage: 'LATHE-BORE', sc: '101' };
    expect(getMachineForRow(row1)).toBe('CON LATHE');

    const row2 = { currentStage: 'VA', sc: '102' };
    expect(getMachineForRow(row2)).toBe('');

    const row3 = { currentStage: '', status2: 'MOVE TO LATHE-FB', sc: '103' };
    expect(getMachineForRow(row3)).toBe('GEE DEE WEILER');
  });

  it('should contain all 7 distinct machines in ALL_MACHINES', () => {
    expect(ALL_MACHINES).toContain('CON LATHE');
    expect(ALL_MACHINES).toContain('GEE DEE WEILER');
    expect(ALL_MACHINES).toContain('M1TR');
    expect(ALL_MACHINES).toContain('CG-MANIKAM');
    expect(ALL_MACHINES).toContain('CG-MANIKKAM');
    expect(ALL_MACHINES).toContain('CG-SRINI');
    expect(ALL_MACHINES).toContain('SG-ARUL');
  });
});
