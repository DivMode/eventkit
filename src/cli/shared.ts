import fg from "fast-glob";
import { readFile } from "node:fs/promises";
import { schemaRegistry } from "../registry/eventbridge";
import { Event } from "../runtime/Event";

/**
 * Shared configuration for EventBridge Schema Registry
 */
export function configureRegistry(): void {
  const { Resource } = require("sst");

  schemaRegistry.configure({
    registryName: Resource.SchemaRegistry.registryName,
    region: process.env.AWS_REGION || "us-west-2",
  });

  console.log(`✅ Registry configured: ${Resource.SchemaRegistry.registryName}`);
}

/**
 * Scan project for files that might contain Event definitions
 */
export async function scanForEventFiles(): Promise<string[]> {
  const rootPath = process.cwd();
  const allFiles: string[] = [];

  console.log("📂 Scanning for files...");

  // Scan all TypeScript and JavaScript files in the project
  const pattern = "**/*.{ts,js}";

  const files = await fg(pattern, {
    cwd: rootPath,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/.cache/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/.*",
      "**/.*/**",
      "**/*.test.*",
      "**/*.spec.*",
      "**/test/**",
      "**/tests/**",
      "**/__tests__/**",
      "**/eventkit/**",
      "**/@divmode/eventkit/**"
    ]
  });

  allFiles.push(...files);

  console.log(`📁 Found ${allFiles.length} files to scan`);
  return allFiles;
}

/**
 * Import files and collect Event instances from exports
 */
export async function collectEventInstances(files: string[]): Promise<{
  events: Event<any, any>[];
  importedCount: number;
  failedCount: number;
}> {
  const rootPath = process.cwd();
  const allEvents: Event<any, any>[] = [];
  let importedCount = 0;
  let failedCount = 0;

  for (const file of files) {
    try {
      const fullPath = `${rootPath}/${file}`;

      // Only try to import files that might contain Event definitions
      const content = await readFile(fullPath, 'utf-8');

      // Quick check if file might contain Event instances
      if (content.includes("new Event(") || content.includes("Event({")) {
        const module = await import(fullPath);
        importedCount++;

        // Collect Event instances from module exports
        for (const [, value] of Object.entries(module)) {
          if (value instanceof Event) {
            allEvents.push(value as Event<any, any>);
          }
        }
      }
    } catch (error) {
      // Ignore import errors - many files might not be importable
      failedCount++;
    }
  }

  console.log(`📦 Successfully imported ${importedCount} files (${failedCount} failed)`);
  console.log(`🎯 Found ${allEvents.length} Event instances:`);

  for (const event of allEvents) {
    console.log(`   • ${event.name} (source: ${event.source})`);
  }

  if (allEvents.length === 0) {
    console.log("ℹ️  No Event instances found. Make sure you're using 'new Event({...})' in your code.");
  }

  return { events: allEvents, importedCount, failedCount };
}