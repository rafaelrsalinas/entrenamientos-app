import { parseWorkbook } from './parse-workbook.ts';

const file = process.argv[2] ?? 'G:/Mi unidad/entrenamientos/plantilla_bombero_v9.xlsx';
const out = parseWorkbook(file);
console.log(JSON.stringify({
  phase_count: out.phases.length,
  exercise_count: out.unique_exercises.length,
  phases: out.phases.map(p => ({
    code: p.code,
    name: p.name,
    weeks: `${p.week_start}-${p.week_end}`,
    days: p.workout_days.map(d => ({
      name: d.name,
      dow: d.day_of_week,
      exercises: d.planned_exercises.length,
      sample: d.planned_exercises.slice(0, 3).map(e =>
        `${e.number_label} ${e.exercise_name} (${e.target_scheme})`
      ),
    })),
  })),
}, null, 2));
