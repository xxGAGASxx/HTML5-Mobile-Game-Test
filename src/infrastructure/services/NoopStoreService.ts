import type { Product, PurchaseResult, StoreService } from '../../application/ports';

export class NoopStoreService implements StoreService {
  async isAvailable(): Promise<boolean> {
    return false;
  }

  async getProducts(): Promise<Product[]> {
    return [];
  }

  async purchase(): Promise<PurchaseResult> {
    return { status: 'unavailable' };
  }

  async restorePurchases(): Promise<string[]> {
    return [];
  }
}
