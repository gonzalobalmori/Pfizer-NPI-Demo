/*
 * Generate the UI's write-back lookup from the seed data.
 *
 * The C3 environment a demo runs from may predate the targetSystem/writeBack
 * fields, in which case the backend simply will not send them. Rather than
 * hand-maintaining a second copy in the UI, the lookup is generated from
 * data/ActionPlanTask/ActionPlanTask.json so the two cannot drift.
 *
 * RUN: node scripts/gen-writeback-map.mjs   (from the jJDemo package root)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const tasks = JSON.parse(readFileSync(join(ROOT, 'data', 'ActionPlanTask', 'ActionPlanTask.json'), 'utf8'));

const rows = tasks
  .filter((t) => t.targetSystem)
  .map((t) => `  ${JSON.stringify(t.id)}: [${JSON.stringify(t.targetSystem)}, ${JSON.stringify(t.writeBack ?? '')}],`);

const out = `/*
 * GENERATED — do not edit by hand. Regenerate with scripts/gen-writeback-map.mjs.
 *
 * Action task -> [system of record, the write executed there]. Used as a
 * fallback when the backend predates the targetSystem/writeBack fields, so the
 * write-back story still renders against an older C3 environment.
 */
export const WRITE_BACK: Record<string, [string, string]> = {
${rows.join('\n')}
};
`;

const dest = join(ROOT, 'ui', 'react', 'src', 'writeBackMap.ts');
writeFileSync(dest, out);
console.log(`wrote ${rows.length} write-back entries -> ui/react/src/writeBackMap.ts`);

/*
 * The assignable colleagues, for the action-plan assign picker. Same reason as
 * above: the picker has to work against an environment that may not expose
 * Person, and a hand-kept second copy of the org would drift.
 */
const people = JSON.parse(readFileSync(join(ROOT, 'seed', 'Person', 'Person.json'), 'utf8'))
  .filter((p) => !p.isBoard)
  .map((p) => ({ id: p.id, name: p.name, initials: p.initials, role: p.role }));

const peopleOut = `/*
 * GENERATED — do not edit by hand. Regenerate with scripts/gen-writeback-map.mjs.
 *
 * Assignable colleagues for the action-plan assign picker. The Launch Board is
 * excluded: it is a decision body you escalate to, not a person you assign work to.
 */
export interface Person {
  id: string;
  name: string;
  initials: string;
  role: string;
}

export const PEOPLE: Person[] = [
${people.map((p) => `  ${JSON.stringify(p)},`).join('\n')}
];
`;

writeFileSync(join(ROOT, 'ui', 'react', 'src', 'execution', 'people.ts'), peopleOut);
console.log(`wrote ${people.length} assignable people -> ui/react/src/execution/people.ts`);
