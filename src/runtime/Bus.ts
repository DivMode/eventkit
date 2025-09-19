import {
  type EventBridgeClient,
  PutEventsCommand,
  type PutEventsRequestEntry,
  type PutEventsResponse,
  type PutEventsResultEntry,
} from "@aws-sdk/client-eventbridge";

/**
 * EventBridge Bus class
 *
 * Wraps AWS EventBridge client with clean API and automatic batching.
 * Handles chunking and error management transparently.
 */
export class Bus {
  private _name: string;
  private _eventBridge: EventBridgeClient;

  constructor({
    name,
    EventBridge,
  }: {
    name: string;
    EventBridge: EventBridgeClient;
  }) {
    this._name = name;
    this._eventBridge = EventBridge;
  }

  get name(): string {
    return this._name;
  }

  /**
   * Publish events to EventBridge
   */
  async put(events: PutEventsRequestEntry[]): Promise<PutEventsResponse> {
    // Add EventBusName to all entries
    const entries = events.map((entry) => ({
      ...entry,
      EventBusName: this._name,
    }));

    // Handle chunking if needed (EventBridge has 256KB limit per request)
    const chunkedEntries = this.chunkEntries(entries);

    if (chunkedEntries.length === 1) {
      // Single chunk - direct send
      const command = new PutEventsCommand({ Entries: chunkedEntries[0] });
      return this._eventBridge.send(command);
    }

    // Multiple chunks - send all and merge results
    const results = await Promise.all(
      chunkedEntries.map((chunk) => {
        const command = new PutEventsCommand({ Entries: chunk });
        return this._eventBridge.send(command);
      }),
    );

    // Merge all results into single response
    return results.reduce<{
      Entries: PutEventsResultEntry[];
      FailedEntryCount: number;
    }>(
      (merged, result) => {
        if (result.FailedEntryCount) {
          merged.FailedEntryCount += result.FailedEntryCount;
        }
        if (result.Entries) {
          merged.Entries.push(...result.Entries);
        }
        return merged;
      },
      { Entries: [], FailedEntryCount: 0 },
    );
  }

  /**
   * Chunk entries to stay within EventBridge limits
   * - Max 10 entries per request
   * - Max 256KB per request
   */
  private chunkEntries(
    entries: PutEventsRequestEntry[],
  ): PutEventsRequestEntry[][] {
    const chunks: PutEventsRequestEntry[][] = [];
    let currentChunk: PutEventsRequestEntry[] = [];
    let currentSize = 0;

    for (const entry of entries) {
      const entrySize = this.computeEventSize(entry);

      // Start new chunk if limits exceeded
      if (
        currentChunk.length >= 10 || // Max entries per request
        currentSize + entrySize > 256000 || // Max size per request (256KB)
        (currentChunk.length > 0 && currentSize + entrySize > 256000)
      ) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentSize = 0;
        }
      }

      currentChunk.push(entry);
      currentSize += entrySize;
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [[]];
  }

  /**
   * Compute size of a single event entry
   */
  private computeEventSize(entry: PutEventsRequestEntry): number {
    let size = 0;

    if (entry.Time) size += 14; // Timestamp size
    if (entry.Detail) size += Buffer.byteLength(entry.Detail, "utf8");
    if (entry.DetailType) size += Buffer.byteLength(entry.DetailType, "utf8");
    if (entry.Source) size += Buffer.byteLength(entry.Source, "utf8");
    if (entry.Resources) {
      entry.Resources.forEach((resource) => {
        size += Buffer.byteLength(resource, "utf8");
      });
    }

    return size;
  }
}
