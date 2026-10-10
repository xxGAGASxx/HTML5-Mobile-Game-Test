import { it } from 'vitest';
import { simulateRun } from '../src/application/simulate';
import { CONTENT } from '../src/data/content';

it('prints a simulated run', () => {
  console.table(simulateRun(CONTENT, Number(process.env.SIM_BATTLES ?? 60), Number(process.env.SIM_SEED ?? 1)));
});
