export interface Product {
  id: string; // e.g. 'pearls_small', 'remove_ads', 'expedition_pass'
  title: string;
  priceLabel: string; // localized string from the store; never computed by us
  kind: 'consumable' | 'non_consumable' | 'subscription';
}

export type PurchaseResult =
  | { status: 'purchased'; productId: string; receipt: string }
  | { status: 'cancelled' }
  | { status: 'pending' }
  | { status: 'unavailable' };

export interface StoreService {
  isAvailable(): Promise<boolean>;
  getProducts(): Promise<Product[]>;
  purchase(productId: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<string[]>; // owned non-consumable/subscription ids
}
