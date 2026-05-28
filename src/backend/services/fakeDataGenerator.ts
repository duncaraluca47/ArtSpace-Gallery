import { faker } from "@faker-js/faker";
import type { WebSocket } from "ws";
import type { Artwork } from "../types";

export class FakeDataGenerator {
  private generationInterval: NodeJS.Timeout | null = null;
  private isGenerating = false;
  private clients: Set<WebSocket> = new Set();

  /**
   * Subscribe a client to receive real-time updates
   */
  subscribe(ws: WebSocket) {
    this.clients.add(ws);

    ws.on("close", () => {
      this.clients.delete(ws);
    });
  }

  /**
   * Broadcast new artworks to all connected clients
   */
  private broadcast(artworks: Artwork[]) {
    const message = JSON.stringify({
      type: "artworks_created",
      data: artworks,
      timestamp: new Date().toISOString(),
    });

    this.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    });
  }

  /**
   * Generate a fake artwork with realistic data
   */
  private generateFakeArtwork(id: string): Artwork {
    return {
      id,
      title: faker.commerce.productName(),
      artist: faker.person.fullName(),
      year: faker.number.int({ min: 1950, max: 2024 }),
      price: faker.number.int({ min: 500, max: 50000 }),
      category: faker.helpers.arrayElement([
        "Painting",
        "Sculpture",
        "Photography",
        "Digital",
        "Mixed Media",
      ]),
      description: faker.lorem.sentences(3),
      imageUrl: faker.image.url(),
      reviews: [],
      likes: faker.number.int({ min: 0, max: 500 }),
    };
  }

  /**
   * Start generating fake data at regular intervals
   * @param batchSize - Number of artworks to generate per batch
   * @param intervalMs - Interval in milliseconds between batches
   * @param onBatch - Callback when a batch is generated
   */
  startGeneration(
    batchSize: number = 3,
    intervalMs: number = 5000,
    onBatch: (artworks: Artwork[]) => void
  ) {
    if (this.isGenerating) {
      return;
    }

    this.isGenerating = true;

    this.generationInterval = setInterval(() => {
      const batch: Artwork[] = [];

      for (let i = 0; i < batchSize; i++) {
        const id = faker.string.uuid();
        batch.push(this.generateFakeArtwork(id));
      }

      onBatch(batch);
      this.broadcast(batch);
    }, intervalMs);
  }

  /**
   * Stop the fake data generation loop
   */
  stopGeneration() {
    if (this.generationInterval) {
      clearInterval(this.generationInterval);
      this.generationInterval = null;
    }
    this.isGenerating = false;

    // Notify clients that generation stopped
    const message = JSON.stringify({
      type: "generation_stopped",
      timestamp: new Date().toISOString(),
    });

    this.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }

  /**
   * Check if generation is currently active
   */
  isActive(): boolean {
    return this.isGenerating;
  }
}
