import type { z } from "zod";

/**
 * Generate EventBridge JSON path mappings from a Zod schema.
 *
 * Works with ANY infrastructure tool (CDK, Terraform, SST, CloudFormation).
 * Converts a Zod object schema into EventBridge-compatible JSON path mappings
 * for use with httpTarget.queryStringParameters or httpTarget.headerParameters.
 *
 * ⚠️ NOTE: EventBridge sends ALL mapped query params, even when values don't exist.
 * AWS returns empty string for missing JSON paths: `?page=&limit=&search=actualValue`
 *
 * Solutions:
 * 1. Filter empty params on receiving end: `{k: v for k, v in params.items() if v}`
 * 2. Use `transform` to put params in body instead
 *
 * @param schema - A Zod object schema to extract keys from
 * @param field - The field name in the EventBridge detail where data lives
 * @returns Record mapping each schema key to its EventBridge JSON path
 *
 * @example
 * ```typescript
 * const QueryParams = z.object({
 *   page: z.number(),
 *   limit: z.number(),
 *   search: z.string().optional(),
 * });
 *
 * const mappings = schemaToJsonPaths(QueryParams, "params");
 * // Result: {
 * //   page: "$.detail.params.page",
 * //   limit: "$.detail.params.limit",
 * //   search: "$.detail.params.search"
 * // }
 *
 * // Or use transform to put params in body instead
 * // transform: (event) => ({ params: event.params })
 * ```
 */
export function schemaToJsonPaths(
  schema: z.ZodObject<z.ZodRawShape>,
  field: string,
): Record<string, string> {
  const keys = Object.keys(schema.shape);
  return Object.fromEntries(keys.map((k) => [k, `$.detail.${field}.${k}`]));
}
