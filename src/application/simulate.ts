import type { GameContent } from './content';
import { GameSession } from './GameSession';

export interface SimStep {
  readonly battle: number;
  readonly wave: number;
  readonly won: boolean;
  readonly seconds: number;
  readonly power: number;
  readonly threat: number;
  readonly gold: number;
  readonly food: number;
  /** Units hired, and types trained (marked with +), after this battle. */
  readonly hired: readonly string[];
}

/**
 * Headless playthrough of the intended path (GDD 08 tuning tooling): fight with no taps
 * (Rally auto-fires at half strength), then hire the cheapest affordable unit (or train the cheapest
 * type once the army is full), repeat.
 */
export function simulateRun(content: GameContent, battles: number, seed = 1): SimStep[] {
  const session = new GameSession(content, seed);
  const steps: SimStep[] = [];
  for (let i = 1; i <= battles; i++) {
    const prepared = session.beginBattle();
    prepared.battle.runToEnd();
    const report = session.finishBattle();
    const hired: string[] = [];
    for (;;) {
      const offer = session
        .tavernOffers()
        .filter((o) => o.canHire)
        .sort((a, b) => a.price.gold - b.price.gold)[0];
      if (offer) {
        session.hire(offer.type.id);
        hired.push(offer.type.id);
        continue;
      }
      const training = session
        .trainingOffers()
        .filter((o) => o.canTrain)
        .sort((a, b) => a.price.gold - b.price.gold)[0];
      // Save up for a hire while the army has room; train only once it is full.
      if (!training || !session.army.isFull) break;
      session.train(training.type.id);
      hired.push(`${training.type.id}+`);
    }
    steps.push({
      battle: i,
      wave: report.wave,
      won: report.outcome.winner === 'player',
      seconds: report.outcome.ticks / 10,
      power: prepared.power,
      threat: prepared.threat,
      gold: session.wallet.balance.gold,
      food: session.wallet.balance.food,
      hired,
    });
  }
  return steps;
}
