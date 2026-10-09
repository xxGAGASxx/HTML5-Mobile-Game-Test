import { defineConfig } from 'vitest/config';

// `npm run sim`: headless economy simulator (GDD 08). Not part of `npm test`.
export default defineConfig({
  test: {
    root: new URL('..', import.meta.url).pathname,
    include: ['scripts/**/*.sim.ts'],
    environment: 'node',
  },
});
