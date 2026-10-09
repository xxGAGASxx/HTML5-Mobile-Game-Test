import { describe, expect, it } from 'vitest';
import { Wallet, hirePrice, trainPrice } from '.';

describe('Wallet', () => {
  it('earns and spends', () => {
    const wallet = new Wallet({ gold: 10, food: 5 });
    wallet.earn({ gold: 5, food: 0 });
    wallet.spend({ gold: 12, food: 5 });
    expect(wallet.balance).toEqual({ gold: 3, food: 0 });
  });

  it('never goes negative', () => {
    const wallet = new Wallet({ gold: 10, food: 0 });
    expect(wallet.canAfford({ gold: 10, food: 1 })).toBe(false);
    expect(() => wallet.spend({ gold: 10, food: 1 })).toThrow();
    expect(wallet.balance).toEqual({ gold: 10, food: 0 });
  });
});

describe('Pricing', () => {
  it('raises hire prices per copy, rounded to 5', () => {
    expect(hirePrice({ gold: 50, food: 15 }, 0)).toEqual({ gold: 50, food: 15 });
    expect(hirePrice({ gold: 50, food: 15 }, 1)).toEqual({ gold: 70, food: 20 });
  });

  it('keeps free parts free and never rounds a cost down to zero', () => {
    expect(hirePrice({ gold: 1, food: 0 }, 0)).toEqual({ gold: 5, food: 0 });
  });

  it('raises training prices per level', () => {
    expect(trainPrice({ gold: 40, food: 10 }, 1)).toEqual({ gold: 40, food: 10 });
    expect(trainPrice({ gold: 40, food: 10 }, 3)).toEqual({ gold: 90, food: 25 });
  });
});
