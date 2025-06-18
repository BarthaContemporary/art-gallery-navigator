
import { MapError, MAP_ERROR_CODES, createMapError } from "./mapErrors";

export class ContainerValidator {
  isContainerReady(containerRef: React.RefObject<HTMLDivElement>): boolean {
    if (!containerRef.current) {
      return false;
    }
    
    const container = containerRef.current;
    
    if (!container.isConnected) {
      return false;
    }
    
    const { width, height } = container.getBoundingClientRect();
    return width > 0 && height > 0;
  }

  async waitForContainer(
    containerRef: React.RefObject<HTMLDivElement>,
    maxAttempts: number = 10
  ): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      if (this.isContainerReady(containerRef)) {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw createMapError(
      MAP_ERROR_CODES.CONTAINER_NOT_FOUND,
      'Map container is not ready after waiting',
      { attempts: maxAttempts }
    );
  }
}
