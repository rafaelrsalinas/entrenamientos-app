import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

export type ParsedPlannedExercise = {
  order_idx: number;
  number_label: string;          // "1", "2", "—"
  block_label: string;
  exercise_name: string;
  target_scheme: string;
  rest_text: string;
  rir_text: string;
  substitution: string;
  notes: string;
  superset_key: string | null;   // "A" extracted from "[SS-A1]"
  weekly_plan: Record<number, string>;   // { 1: "45", 2: "46.5", ... }
};

export type ParsedWorkoutDay = {
  order_idx: number;
  name: string;                  // "LUNES — LOWER (Fuerza pierna) + Dom Volumen Ligero"
  day_of_week: number | null;    // 1..7 or null
  planned_exercises: ParsedPlannedExercise[];
};

export type ParsedPhase = {
  code: string;                  // "F1_HIPERTROFIA"
  name: string;                  // "FASE 1 — HIPERTROFIA + BASE"
  description: string;
  week_start: number;
  week_end: number;
  order_idx: number;
  workout_days: ParsedWorkoutDay[];
};

const PHASE_SHEET_CODES = ['F1_HIPERTROFIA', 'F2_TRANSICION', 'F3_ESPECIALIZ', 'F4_PUESTA_PUNTO'] as const;

// Strict: must start with the full weekday name, followed by space + em-dash (—) or hyphen.
// Matches the actual format used in the workbook: "LUNES — LOWER ...", "MIÉRCOLES — UPPER A ..."
const DAY_HEADER_RE = /^(LUNES|MARTES|MI[ÉE]RCOLES|JUEVES|VIERNES|S[ÁA]BADO|DOMINGO)\s*[—–-]/i;
const DAY_NUM: Record<string, number> = {
  LUNES: 1,
  MARTES: 2,
  MIERCOLES: 3, MIÉRCOLES: 3,
  JUEVES: 4,
  VIERNES: 5,
  SABADO: 6, SÁBADO: 6,
  DOMINGO: 7,
};

const SUPERSET_RE = /\[SS-([A-Z])\d+\]/i;

function cellStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return String(v);
}

function isColumnHeaderRow(row: unknown[]): boolean {
  const first = cellStr(row[0]);
  const second = cellStr(row[1]);
  return first === '#' && /^bloque$/i.test(second);
}

function isDayHeaderRow(row: unknown[]): boolean {
  const first = cellStr(row[0]);
  if (!first) return false;
  if (!DAY_HEADER_RE.test(first)) return false;
  // rest of the columns must be empty (true section break)
  for (let i = 1; i < row.length; i++) if (cellStr(row[i])) return false;
  return true;
}

function parseDayOfWeek(header: string): number | null {
  const m = header.match(DAY_HEADER_RE);
  if (!m) return null;
  return DAY_NUM[m[1].toUpperCase()] ?? null;
}

function parseSupersetKey(block: string): string | null {
  const m = block.match(SUPERSET_RE);
  return m ? m[1].toUpperCase() : null;
}

function parsePhaseMeta(sheetName: string, rows: unknown[][], order_idx: number): Omit<ParsedPhase, 'workout_days'> {
  const title = cellStr(rows[0]?.[0]);                     // "FASE 1 — HIPERTROFIA + BASE  ·  Semanas 1-26"
  const desc = [1, 2, 3, 4]
    .map(i => cellStr(rows[i]?.[0]))
    .filter(Boolean)
    .join('\n');
  // weeks from title: "Semanas 1-26" or "Semanas 27-52"
  const weekMatch = title.match(/Semanas?\s+(\d+)\s*[-–]\s*(\d+)/i);
  const week_start = weekMatch ? parseInt(weekMatch[1], 10) : 1;
  const week_end   = weekMatch ? parseInt(weekMatch[2], 10) : 26;
  const cleanTitle = title.split('·')[0].trim();
  return { code: sheetName, name: cleanTitle, description: desc, week_start, week_end, order_idx };
}

function parsePhaseSheet(wb: XLSX.WorkBook, sheetName: string, order_idx: number): ParsedPhase | null {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return null;
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  const meta = parsePhaseMeta(sheetName, rows, order_idx);

  const workout_days: ParsedWorkoutDay[] = [];
  let currentDay: ParsedWorkoutDay | null = null;
  let currentExercise: ParsedPlannedExercise | null = null;
  let exerciseOrder = 0;
  let weekHeaders: number[] = []; // maps col index (starting at 9) to week number

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Day header?
    if (isDayHeaderRow(row)) {
      const name = cellStr(row[0]);
      currentDay = {
        order_idx: workout_days.length,
        name,
        day_of_week: parseDayOfWeek(name),
        planned_exercises: [],
      };
      workout_days.push(currentDay);
      currentExercise = null;
      exerciseOrder = 0;
      continue;
    }

    // Column header (repeats per day)?
    if (isColumnHeaderRow(row)) {
      // Parse week headers from col 9 onwards: "S1", "S2"...
      weekHeaders = [];
      for (let c = 9; c < row.length; c++) {
        const h = cellStr(row[c]);
        const m = h.match(/^S(\d+)$/i);
        weekHeaders[c - 9] = m ? parseInt(m[1], 10) : 0;
      }
      continue;
    }

    if (!currentDay) continue; // lines before first day header

    // Is this an exercise definition row (has non-empty Bloque or Ejercicio + SERIE="PLAN" or number label)?
    const colNumber = cellStr(row[0]);            // "#"
    const colBloque = cellStr(row[1]);
    const colEjerc  = cellStr(row[2]);
    const colPauta  = cellStr(row[3]);
    const colDesc   = cellStr(row[4]);
    const colRir    = cellStr(row[5]);
    const colSust   = cellStr(row[6]);
    const colNotas  = cellStr(row[7]);
    const colSerie  = cellStr(row[8]);

    // PLAN row or a row that introduces a new exercise (has exercise name)
    const isPlanRow   = colSerie.toUpperCase() === 'PLAN';
    const isSeriesRow = /^S\d+$/i.test(colSerie);
    const isDashRow   = colSerie === '—' || colSerie === '-';

    if (colEjerc && (isPlanRow || isDashRow || (!isSeriesRow && colBloque))) {
      // new exercise
      exerciseOrder++;
      currentExercise = {
        order_idx: exerciseOrder,
        number_label: colNumber,
        block_label: colBloque,
        exercise_name: colEjerc,
        target_scheme: colPauta,
        rest_text: colDesc,
        rir_text: colRir,
        substitution: colSust,
        notes: colNotas,
        superset_key: parseSupersetKey(colBloque),
        weekly_plan: {},
      };
      currentDay.planned_exercises.push(currentExercise);
      // extract weekly plan from cols 9..
      if (isPlanRow) {
        for (let c = 9; c < row.length; c++) {
          const wn = weekHeaders[c - 9];
          if (wn > 0) {
            const v = cellStr(row[c]);
            if (v && v !== '—' && v !== '-') currentExercise.weekly_plan[wn] = v;
          }
        }
      } else if (isDashRow) {
        // single column value (treat as week 1 plan)
        const v = cellStr(row[9]);
        if (v && v !== '—' && v !== '-') currentExercise.weekly_plan[1] = v;
      }
      continue;
    }

    // Additional notes row (same exercise continues) — col H may add info
    if (currentExercise && !isSeriesRow && !isPlanRow && colNotas && !colEjerc) {
      if (currentExercise.notes) currentExercise.notes += ' · ' + colNotas;
      else currentExercise.notes = colNotas;
      continue;
    }

    // Series rows (S1..S5): skip — they're the logger's own past data, not the plan
  }

  return { ...meta, workout_days };
}

export function parseWorkbook(filePath: string): { phases: ParsedPhase[]; unique_exercises: string[] } {
  const wb = XLSX.read(readFileSync(filePath));
  const phases: ParsedPhase[] = [];
  for (const [i, code] of PHASE_SHEET_CODES.entries()) {
    const p = parsePhaseSheet(wb, code, i);
    if (p) phases.push(p);
  }
  const names = new Set<string>();
  for (const p of phases) for (const d of p.workout_days) for (const e of d.planned_exercises) {
    if (e.exercise_name) names.add(e.exercise_name);
  }
  return { phases, unique_exercises: [...names].sort() };
}

