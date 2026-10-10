/** Potions the player carries between battles: a small stack of each kind. */
export class Satchel {
  private readonly stock = new Map<string, number>();

  constructor(
    /** Most of one kind the player can carry. */
    readonly stackLimit: number,
    start: Readonly<Record<string, number>> = {},
  ) {
    for (const [id, n] of Object.entries(start)) this.stock.set(id, Math.min(stackLimit, n));
  }

  count(id: string): number {
    return this.stock.get(id) ?? 0;
  }

  isFull(id: string): boolean {
    return this.count(id) >= this.stackLimit;
  }

  add(id: string): void {
    if (this.isFull(id)) throw new Error(`Can't carry more ${id}`);
    this.stock.set(id, this.count(id) + 1);
  }

  take(id: string): void {
    if (this.count(id) <= 0) throw new Error(`No ${id} left`);
    this.stock.set(id, this.count(id) - 1);
  }
}
