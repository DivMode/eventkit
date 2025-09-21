import type { PutEventsRequestEntry, PutEventsResponse } from "@aws-sdk/client-eventbridge";
import type { z } from "zod";
import type { Bus } from "./Bus";

// =============================================================================
// EventBridge Operator Types
// =============================================================================

/**
 * AWS EventBridge comparison operators for numeric values
 */
export type NumericComparison = [
  ">" | "<" | "=" | "<=" | ">=",
  number,
  ...Array<">" | "<" | "=" | "<=" | ">=" | number>
];

/**
 * Nested operators for equals-ignore-case combinations
 */
export interface CaseInsensitiveOperators {
  "equals-ignore-case": string;
}

/**
 * Base string matching operators
 */
export interface BaseStringOperators {
  prefix?: string | CaseInsensitiveOperators;
  suffix?: string | CaseInsensitiveOperators;
  wildcard?: string;
  "equals-ignore-case"?: string;
  cidr?: string;  // IP address CIDR matching
}

/**
 * Anything-but operator with nested support
 */
export interface AnythingButOperator {
  "anything-but"?:
    | string | string[]
    | number | number[]
    | boolean | boolean[]
    | null
    | BaseStringOperators
    | { prefix: string | string[] }
    | { suffix: string | string[] }
    | { wildcard: string | string[] }
    | { cidr: string | string[] }
    | { "equals-ignore-case": string | string[] };
}

/**
 * AWS EventBridge operators for string fields
 */
export interface StringOperators extends BaseStringOperators, AnythingButOperator {
  exists?: boolean;
}

/**
 * AWS EventBridge operators for numeric fields
 */
export interface NumericOperators extends AnythingButOperator {
  numeric?: NumericComparison;
  exists?: boolean;
}

/**
 * AWS EventBridge operators for any field type
 */
export interface UniversalOperators<T> extends AnythingButOperator {
  exists?: boolean;
}

/**
 * Complete EventBridge filter value type with all AWS operators
 * Supports null values, empty strings, and all AWS EventBridge operators
 */
export type EventBridgeFilterValue<T> =
  | T[]  // Exact matching: ["value1", "value2"]
  | null[]  // Null matching: [null]
  | Array<T | null | (
      T extends string ? StringOperators :
      T extends number ? NumericOperators :
      UniversalOperators<T>
    )>;

/**
 * Type-safe EventBridge filter for event properties
 */
export type EventFilter<S extends z.ZodType> = {
  [K in keyof z.infer<S>]?: EventBridgeFilterValue<z.infer<S>[K]>
} & {
  $or?: Array<EventFilter<S>>;  // Compound OR operator
};

// =============================================================================
// Exact Type Helpers
// =============================================================================

/**
 * Helper type to make extra properties impossible
 */
type Impossible<K extends keyof any> = {
  [P in K]: never;
};

/**
 * Enforces exact type matching - no extra properties allowed
 * This approach gives the best error messages TypeScript can provide
 */
type NoExtraProperties<T, U extends T = T> = U & Impossible<Exclude<keyof U, keyof T>>;

// =============================================================================
// Event Class
// =============================================================================

/**
 * Type-safe Event class with built-in EventBridge pattern generation
 *
 * Features:
 * - Full AWS EventBridge operator support
 * - Type-safe filtering based on Zod schema
 * - Pattern generation for single and multiple events
 * - Zero-overhead TypeScript integration
 */
export class Event<N extends string, S extends z.ZodType> {
  private readonly _name: N;
  private readonly _source: string;
  private readonly _bus: Bus | (() => Bus);
  private readonly _schema: S;
  private _resolvedBus?: Bus;

  // Type inference helpers for external use
  declare readonly _schemaType: z.infer<S>;
  declare readonly _filterType: EventFilter<S>;

  constructor(config: {
    name: N;
    source: string;
    bus: Bus | (() => Bus);
    schema: S;
  }) {
    this._name = config.name;
    this._source = config.source;
    this._bus = config.bus;
    this._schema = config.schema;
  }

  get name(): N {
    return this._name;
  }

  get source(): string {
    return this._source;
  }

  get schema(): S {
    return this._schema;
  }

  get type(): N {
    return this._name;
  }

  private get bus(): Bus {
    if (!this._resolvedBus) {
      this._resolvedBus = typeof this._bus === 'function' ? this._bus() : this._bus;
    }
    return this._resolvedBus;
  }

  /**
   * Create a PutEventsRequestEntry for publishing
   */
  create(properties: z.infer<S>): PutEventsRequestEntry {
    const validated = this._schema.parse(properties);
    const entry = {
      Source: this._source,
      DetailType: this._name,
      Detail: JSON.stringify({ properties: validated }),
    };

    // Attach bus reference for multi-bus support (hidden property)
    Object.defineProperty(entry, '__bus', {
      value: this.bus,
      enumerable: false,   // Won't show in JSON.stringify
      writable: false,
      configurable: false
    });

    return entry;
  }

  /**
   * Publish event(s) to EventBridge
   * Supports single event, array of events, or mixed event types with automatic multi-bus routing
   * Enforces strict type checking to prevent extra properties
   */
  async publish<U extends z.infer<S>>(
    data: NoExtraProperties<z.infer<S>, U> | NoExtraProperties<z.infer<S>, U>[] | PutEventsRequestEntry[]
  ): Promise<PutEventsResponse> {
    if (Array.isArray(data)) {
      if (data.length === 0) {
        throw new Error("Cannot publish empty events array");
      }

      // Check if it's an array of PutEventsRequestEntry (mixed types)
      const firstItem = data[0];
      if (isPutEventsRequestEntry(firstItem)) {
        // TypeScript now knows this is PutEventsRequestEntry[]
        const entries = data as PutEventsRequestEntry[];

        // Verify all entries use the same bus
        const firstBus = getBusFromEntry(firstItem) || this.bus;

        for (const entry of entries) {
          const entryBus = getBusFromEntry(entry) || this.bus;
          if (entryBus !== firstBus) {
            throw new Error(
              "Cannot publish events from different buses in single call. " +
              "Use separate publish() calls per bus for better isolation and clarity."
            );
          }
        }

        // All entries use same bus - proceed normally
        return firstBus.put(entries);
      }

      // If we reach here, TypeScript should know it's z.infer<S>[]
      // But we'll be explicit to help the compiler
      const schemaEntries = data.filter(item => !isPutEventsRequestEntry(item)) as z.infer<S>[];
      const entries = schemaEntries.map(props => this.create(props));
      return this.bus.put(entries);
    } else {
      // Single event publishing - cast to z.infer<S> for internal use
      return this.bus.put([this.create(data as z.infer<S>)]);
    }
  }

  /**
   * Generate type-safe EventBridge pattern with optional filtering
   */
  pattern(filter?: EventFilter<S>): Record<string, unknown> {
    const basePattern = {
      source: [this._source],
      "detail-type": [this._name],
    };

    return filter ? {
      ...basePattern,
      detail: { properties: filter }
    } : basePattern;
  }

  /**
   * Generate EventBridge pattern for multiple events with shared filtering
   */
  static computePattern<E extends Event<string, z.ZodType>>(
    events: E[],
    filter?: EventFilter<E["schema"]>
  ): Record<string, unknown> {
    if (events.length === 0) {
      throw new Error("Cannot compute pattern for empty events array");
    }

    const sources = [...new Set(events.map(e => e.source))];
    const detailTypes = events.map(e => e.name);

    const basePattern = {
      source: sources,
      "detail-type": detailTypes,
    };

    return filter ? {
      ...basePattern,
      detail: { properties: filter }
    } : basePattern;
  }

}

// =============================================================================
// Internal Utilities
// =============================================================================

/**
 * Type guard to check if value is a PutEventsRequestEntry
 */
function isPutEventsRequestEntry(value: any): value is PutEventsRequestEntry {
  return value &&
    typeof value === 'object' &&
    typeof value.Source === 'string' &&
    typeof value.DetailType === 'string' &&
    (value.Detail === undefined || typeof value.Detail === 'string');
}

/**
 * Extract bus from a PutEventsRequestEntry created by Event.create()
 */
function getBusFromEntry(entry: PutEventsRequestEntry): Bus | undefined {
  return (entry as any).__bus;
}


// =============================================================================
// Type Helpers for External Use
// =============================================================================

/**
 * Extract filter type from Event instance
 */
export type FilterFor<E extends Event<string, z.ZodType>> = E["_filterType"];

/**
 * Extract schema type from Event instance
 */
export type SchemaFor<E extends Event<string, z.ZodType>> = E["_schemaType"];