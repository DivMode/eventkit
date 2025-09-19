import type { z } from "zod";
import type { Event, SchemaFor } from "../../runtime/Event";
import type { InputTransformerConfig, TransformFunction } from "./types";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract field names from a Zod schema safely
 * Returns empty array if schema inspection fails or is not supported
 */
function extractSchemaFields(schema: z.ZodType): string[] {
  // For safety, we'll only support ZodObject schemas and return empty for others
  // This avoids relying on internal Zod APIs that may change
  try {
    // Use a safer approach - parse with empty object to see what fields are expected
    const result = schema.safeParse({});
    if (!result.success && result.error.issues) {
      // Extract field names from validation errors
      const fields = new Set<string>();
      for (const issue of result.error.issues) {
        if (issue.path.length > 0 && typeof issue.path[0] === "string") {
          fields.add(issue.path[0]);
        }
      }
      return Array.from(fields);
    }
  } catch {
    // Fallback if any error occurs
  }
  return [];
}

/**
 * Create a proxy object to track property access during transform function execution
 */
function createEventProxy(accessedFields: Set<string>): Record<string, string> {
  return new Proxy({} as Record<string, string>, {
    get(_, prop) {
      if (typeof prop === "string") {
        accessedFields.add(prop);
        return `<${prop}>`; // Return placeholder for template
      }
      return undefined;
    },
  });
}

/**
 * Create a proxy for system fields (time, source)
 */
function createSystemProxy(systemFields: Set<string>): {
  time: string;
  source: string;
} {
  return new Proxy(
    { time: "", source: "" },
    {
      get(_, prop) {
        if (typeof prop === "string") {
          systemFields.add(prop);
          return `<${prop}>`; // Return placeholder for template
        }
        return undefined;
      },
    },
  );
}

/**
 * Check if an object contains the event proxy (indicates full event usage)
 */
function containsEventProxy(
  obj: unknown,
  proxy: Record<string, string>,
): boolean {
  if (obj === proxy) return true;
  if (typeof obj !== "object" || obj === null) return false;

  for (const value of Object.values(obj)) {
    if (containsEventProxy(value, proxy)) return true;
  }
  return false;
}

/**
 * Reconstruct the result object, replacing the proxy with the template
 */
function reconstructWithTemplate(
  obj: unknown,
  proxy: Record<string, string>,
  replacement: Record<string, string>,
): unknown {
  if (obj === proxy) return replacement;
  if (typeof obj !== "object" || obj === null) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => reconstructWithTemplate(item, proxy, replacement));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = reconstructWithTemplate(value, proxy, replacement);
  }
  return result;
}

/**
 * Generate input paths for EventBridge transformer
 */
function generateInputPaths(
  accessedFields: Set<string>,
  systemFields: Set<string>,
  schemaFields?: string[],
): Record<string, string> {
  const inputPaths: Record<string, string> = {};

  // Add schema fields if using full event
  if (schemaFields) {
    for (const field of schemaFields) {
      inputPaths[field] = `$.detail.properties.${field}`;
    }
  } else {
    // Add individually accessed fields
    for (const field of Array.from(accessedFields)) {
      inputPaths[field] = `$.detail.properties.${field}`;
    }
  }

  // Add system field paths
  for (const field of Array.from(systemFields)) {
    if (field === "time") {
      inputPaths[field] = "$.time";
    } else if (field === "source") {
      inputPaths[field] = "$.source";
    }
  }

  return inputPaths;
}

// =============================================================================
// MAIN EXPORTED FUNCTIONS
// =============================================================================

/**
 * Create EventBridge inputTransformer from transform function
 *
 * Analyzes what fields the transform function accesses and creates
 * the appropriate input paths and template for EventBridge.
 *
 * @param transform - Function that transforms event data
 * @param eventSchema - Optional event schema for full-event detection
 * @returns InputTransformer configuration for EventBridge
 */
export function createTransform<E extends Event<string, z.ZodType>>(
  transform: TransformFunction<E>,
  eventSchema?: E,
): InputTransformerConfig {
  const accessedFields = new Set<string>();
  const systemFields = new Set<string>();

  // Create proxy objects to track property access
  const eventProxy = createEventProxy(accessedFields);
  const systemProxy = createSystemProxy(systemFields);

  // Execute transform function to capture accesses and get template structure
  const result = transform(eventProxy as z.infer<E["schema"]>, systemProxy);

  // Check if transform uses the full event object
  const usesFullEvent = containsEventProxy(result, eventProxy);

  if (usesFullEvent && eventSchema) {
    // Extract schema fields for full event usage
    const schemaFields = extractSchemaFields(eventSchema.schema);
    const inputPaths = generateInputPaths(
      accessedFields,
      systemFields,
      schemaFields,
    );

    // Create template with all field placeholders
    const eventTemplate: Record<string, string> = {};
    for (const field of schemaFields) {
      eventTemplate[field] = `<${field}>`;
    }

    // Reconstruct result with proper placeholders
    const finalResult = reconstructWithTemplate(
      result,
      eventProxy,
      eventTemplate,
    );

    return {
      inputPaths,
      inputTemplate: JSON.stringify(finalResult),
    };
  }

  // Handle individual field access
  const inputPaths = generateInputPaths(accessedFields, systemFields);

  return {
    inputPaths,
    inputTemplate: JSON.stringify(result),
  };
}
