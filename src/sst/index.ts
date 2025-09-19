/**
 * SST Infrastructure Utilities
 *
 * SST-specific infrastructure helpers that require SST v3 context with global aws.* variables.
 * These utilities are designed to work within SST infrastructure files with the SST runtime.
 *
 * ⚠️ Important: This module requires SST infrastructure context and will not work
 * in runtime environments or without SST's global aws.* variables.
 *
 * @example
 * ```typescript
 * // In SST infrastructure files (infra/*.ts)
 * import { createEventRule } from "@divmode/eventkit/sst";
 *
 * const { rule, target } = createEventRule(DomainDetected, {
 *   name: "ProcessDomains",
 *   bus: { name: Resource.Bus.name },
 *   target: {
 *     destination: { arn: Resource.Queue.arn },
 *     transform: (event) => ({ body: event })
 *   }
 * });
 * ```
 */


// Re-export all EventBridge infrastructure utilities
export * from "./eventbridge/index";