export interface CloudSaveService {
  isAvailable(): Promise<boolean>;
  load(): Promise<{ save: string; updatedAt: number } | null>;
  store(save: string, updatedAt: number): Promise<void>;
}
