import { addResources, type Resources } from './Resources';

/** The player's balance. Never goes negative. */
export class Wallet {
  private current: Resources;

  constructor(start: Resources) {
    this.current = start;
  }

  get balance(): Resources {
    return this.current;
  }

  canAfford(cost: Resources): boolean {
    return this.current.gold >= cost.gold && this.current.food >= cost.food;
  }

  earn(amount: Resources): void {
    if (amount.gold < 0 || amount.food < 0) throw new Error('Earned amounts must be positive');
    this.current = addResources(this.current, amount);
  }

  spend(cost: Resources): void {
    if (!this.canAfford(cost)) throw new Error('Not enough resources');
    this.current = { gold: this.current.gold - cost.gold, food: this.current.food - cost.food };
  }
}
