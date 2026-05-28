# Real-time Fake Data Generation

This feature allows you to generate fake but valid artwork data dynamically, with real-time updates sent to the client via WebSockets. This is useful for:

- **Demonstrating scalability** of the gallery with large datasets
- **Testing UI performance** with varying numbers of artworks
- **Showcasing real-time updates** to the master/detail view and charts

## How It Works

### Backend Components

1. **FakeDataGenerator Service** (`src/backend/services/fakeDataGenerator.ts`)
   - Manages the async generation loop using `setInterval`
   - Generates realistic fake artworks using the `@faker-js/faker` library
   - Broadcasts newly created artworks to all connected WebSocket clients
   - Can be started and stopped on demand

2. **Fake Data Routes** (`src/backend/routes/fakeDataRoutes.ts`)
   - `POST /api/fake-data/start?batchSize=3&intervalMs=5000` - Start generation
   - `POST /api/fake-data/stop` - Stop generation
   - `GET /api/fake-data/status` - Check if generation is running

3. **WebSocket Server**
   - Integrated into Express via `ws` library in `src/backend/server.ts`
   - Listens for client connections and broadcasts messages

### Frontend Components

1. **RealtimeArtworkService** (`src/app/services/realtimeArtworkService.ts`)
   - Manages WebSocket connection to the backend
   - Auto-reconnects with exponential backoff on disconnect
   - Provides a subscription pattern for real-time updates
   - Handles connection lifecycle and error states

2. **FakeDataControl Component** (`src/app/components/FakeDataControl.tsx`)
   - UI button to start/stop fake data generation
   - Shows generation status and loading states
   - Located in the Navigation bar for easy access

3. **ArtworksContext Integration** (`src/app/context/ArtworksContext.tsx`)
   - WebSocket listener automatically added on mount
   - Incoming artworks are appended to the artwork list
   - Triggers automatic chart and master/detail view updates

## Usage

### Starting Demo Data Generation

Click the **"Start Demo Data"** button in the navigation bar. You'll see:

1. Button changes to show **"Generating fake data..."** status
2. A pulsing amber indicator appears
3. New artworks start appearing in the gallery every 5 seconds (default)
4. Charts update in real-time as new artworks are added
5. Master/detail view reflects the growing collection

### Stopping Generation

Click the **"Stop"** button to halt fake data generation. The indicator disappears and the gallery becomes static again.

## Configuration

### Generate Artworks in Batches

When starting generation via the API, you can control:

- **batchSize** (default: 3) - Number of artworks per batch
- **intervalMs** (default: 5000) - Milliseconds between batches

Example:
```bash
# Generate 5 artworks every 2 seconds
curl -X POST 'http://localhost:4000/api/fake-data/start?batchSize=5&intervalMs=2000'
```

## Real-time Message Format

The WebSocket server sends messages in this format:

```json
{
  "type": "artworks_created",
  "data": [
    {
      "id": "acef6203-1d46-44e3-a188-cc05be00f6e2",
      "title": "A Modern Masterpiece",
      "artist": "Jane Smith",
      "year": 2023,
      "price": 15000,
      "category": "Painting",
      "description": "A stunning contemporary work...",
      "imageUrl": "https://example.com/image.jpg",
      "reviews": [],
      "likes": 42
    }
    // ... more artworks
  ],
  "timestamp": "2024-04-30T12:38:45.123Z"
}
```

When generation stops:
```json
{
  "type": "generation_stopped",
  "timestamp": "2024-04-30T12:38:50.456Z"
}
```

## Testing

### Unit Tests

The offline queue functionality still works with WebSocket integration:

```bash
npm run test -- test/context/artworksContext.test.tsx
```

### Integration Testing

When you start demo data generation:

1. Gallery items update in real-time
2. Statistics/charts recalculate automatically
3. No server sync is required (data is generated on-the-fly)
4. Navigation shows real-time count updates

### Manual Testing Steps

1. **Start the app**: `npm run dev` (frontend) and `npm run backend:dev` (backend)
2. **Navigate to gallery**: Visit http://localhost:5173/gallery
3. **Start demo data**: Click "Start Demo Data" button
4. **Observe updates**: Watch artworks appear in real-time
5. **Stop when done**: Click "Stop" button

## Architecture Decisions

### Why WebSockets?

- **Real-time**: Updates appear instantly without polling
- **Efficient**: Server only sends data when available
- **Scalable**: Single connection per client for streaming data

### Why Faker?

- **Realistic**: Generates valid artwork data (titles, prices, years, etc.)
- **Variety**: Each run produces different artworks
- **Fast**: Can generate thousands of items per second

### Why Both Offline Sync AND Real-time Generation?

- **Offline Sync**: Handles network interruptions for user-created CRUD
- **Real-time Generation**: Handles server-generated demo data in real-time
- Together: Complete offline-first + real-time architecture

## Files Modified/Created

### Created Files

- `src/backend/services/fakeDataGenerator.ts` - Fake data generation service
- `src/backend/routes/fakeDataRoutes.ts` - API routes for start/stop
- `src/app/services/realtimeArtworkService.ts` - WebSocket client service
- `src/app/components/FakeDataControl.tsx` - UI control component

### Modified Files

- `src/backend/server.ts` - Added WebSocket server setup
- `src/backend/app.ts` - Integrated fake data router
- `src/app/context/ArtworksContext.tsx` - Added WebSocket listener
- `src/app/components/Navigation.tsx` - Added FakeDataControl button

## Dependencies Added

- `@faker-js/faker` - Generates realistic fake data
- `ws` - WebSocket server implementation
- `@types/ws` - TypeScript types for ws

Install with: `npm install @faker-js/faker ws` and `npm install --save-dev @types/ws`

## Performance Considerations

### Memory Usage

- Each artwork in memory: ~500 bytes
- 1000 artworks: ~500KB
- 10,000 artworks: ~5MB

### Network Usage

- Each WebSocket message: ~1-2KB
- At 3 items/5 seconds: ~180 bytes/sec

### Stopping Generation

If performance degrades with too many items:

1. Click "Stop" button to halt generation
2. Refresh the page to reload a fresh gallery
3. Or restart the backend server

## Future Enhancements

- [ ] Stop at X artworks (cap)
- [ ] Batch size slider UI
- [ ] Interval rate slider UI
- [ ] Export generated data
- [ ] Save generation sessions
- [ ] Replay generation logs
