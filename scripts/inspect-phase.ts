import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'G:/Mi unidad/entrenamientos/plantilla_bombero_v9.xlsx';
const sheetName = process.argv[3] ?? 'F1_HIPERTROFIA';
const wb = XLSX.read(readFileSync(file));
const s = wb.Sheets[sheetName];
if (!s) { console.error('sheet not found'); process.exit(1); }
const rows: unknown[][] = XLSX.utils.sheet_to_json(s, { header: 1, defval: '', blankrows: false });
console.log(`Total rows: ${rows.length}`);
for (const [i, row] of rows.entries()) {
  const cells = row.slice(0, 10).map(c => String(c).slice(0, 45));
  console.log(`${String(i).padStart(3, ' ')}: ${cells.join(' | ')}`);
}
