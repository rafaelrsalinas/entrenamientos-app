import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'G:/Mi unidad/entrenamientos/plantilla_bombero_v9.xlsx';
const wb = XLSX.read(readFileSync(file));
console.log('SHEETS:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const s = wb.Sheets[name];
  const ref = s['!ref'] ?? '(empty)';
  console.log(`\n===== ${name} (${ref}) =====`);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(s, { header: 1, defval: '', blankrows: false });
  const preview = rows.slice(0, 30);
  for (const [i, row] of preview.entries()) {
    const cells = row.map(c => String(c).slice(0, 40));
    console.log(`${String(i).padStart(3, ' ')}: ${cells.join(' | ')}`);
  }
  if (rows.length > 30) console.log(`  ... (${rows.length - 30} more rows)`);
}
