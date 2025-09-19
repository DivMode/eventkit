/**
 * Global type declarations for SST infrastructure context
 *
 * SST v3 provides global variables for Pulumi providers without requiring imports.
 * This file declares the global types to satisfy TypeScript compilation.
 */

/// <reference types="@pulumi/aws" />

declare global {
  /**
   * Global aws variable provided by SST v3 infrastructure context
   * Maps to @pulumi/aws module functionality
   */
  const aws: typeof import("@pulumi/aws");
}

export {};