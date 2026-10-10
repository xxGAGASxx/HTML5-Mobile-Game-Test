import type { GameContent } from './content';
import { GameSession } from './GameSession';

export interface SimStep {
  readonly battle: number;
  readonly node: string;
  readonly won: boolean;
  readonly seconds: number;
  /** Minutes of play since the start, counting battles plus time in camp. */
  readonly minutes: number;
  readonly power: number;
  readonly threat: number;
  readonly gold: number;
  readonly food: number;
  /** Units hired, and types trained (marked with +), after this battle. */
  readonly hired: readonly string[];
  readonly regionCleared: boolean;
}

/** Seconds an idle player spends between battles (map, camp, results). */
const CAMP_SECONDS = 20;

/**
 * Headless playthrough of the intended path (GDD 08 tuning tooling): fight with no taps
 * (Rally auto-fires at half strength), always taking the weakest node not yet cleared (or the
 * weakest one open again), going down every ruin floor, collecting resource sites, then hiring the
 * cheapest affordable unit (or training the cheapest type once the army is full). Repeat.
 */
export function simulateRun(content: GameContent, battles: number, seed = 1): SimStep[] {
  let clock = 0;
  const session = new GameSession(content, seed, () => clock);
  const steps: SimStep[] = [];
  let ruinNode: string | null = null;
  for (let i = 1; i <= battles && !session.map.regionCleared; i++) {
    const nodeId: string | undefined = ruinNode ?? pickNode(session);
    if (!nodeId) {
      clock += 10 * 60_000; // everything is respawning: come back later
      i--;
      continue;
    }
    if (session.partyAt !== nodeId) session.travel(nodeId);
    const prepared = session.beginBattle(nodeId);
    prepared.battle.runToEnd();
    const report = session.finishBattle();
    ruinNode = report.nextFloor ? nodeId : null;
    clock += (report.outcome.ticks / 10 + CAMP_SECONDS) * 1000;

    for (const id of session.map.ids) {
      const harvest = session.nodeInfo(id).harvest;
      if (harvest && harvest.gold + harvest.food > 0 && session.routeTo(id)) {
        session.travel(id);
        session.harvest(id);
      }
    }
    const hired: string[] = [];
    if (!ruinNode) {
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
    }
    steps.push({
      battle: i,
      node: report.floor ? `${nodeId} ${report.floor.index + 1}/${report.floor.count}` : nodeId,
      won: report.outcome.winner === 'player',
      seconds: report.outcome.ticks / 10,
      minutes: Math.round(clock / 6000) / 10,
      power: prepared.power,
      threat: prepared.threat,
      gold: session.wallet.balance.gold,
      food: session.wallet.balance.food,
      hired,
      regionCleared: report.regionCleared,
    });
  }
  return steps;
}

/** The weakest reachable node never cleared, else the weakest one open again. */
function pickNode(session: GameSession): string | undefined {
  const open = session.map.ids
    .map((id) => session.nodeInfo(id))
    .filter((info) => info.status.kind === 'open' && info.threat !== undefined && session.routeTo(info.node.id))
    .sort((a, b) => a.threat! - b.threat!);
  const fresh = open.filter((info) => info.status.kind === 'open' && info.status.firstClear);
  return (fresh[0] ?? open[0])?.node.id;
}
