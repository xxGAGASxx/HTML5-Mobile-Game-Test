import type { CloudSaveService } from '../../application/ports';

export class NoopCloudSaveService implements CloudSaveService {
  async isAvailable(): Promise<boolean> {
    return false;
  }

  async load(): Promise<null> {
    return null;
  }

  async store(): Promise<void> {}
}
