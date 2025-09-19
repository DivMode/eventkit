#!/usr/bin/env node

/**
 * Auto-Sync Script for Event Schemas
 *
 * This script automatically:
 * 1. Finds all TypeScript/JavaScript files in the project
 * 2. Dynamically imports each file (triggers Event constructors)
 * 3. Compares Event instances with existing schemas in EventBridge
 * 4. Updates changed schemas, creates new ones, optionally deletes orphaned ones
 *
 * Works for any project structure - truly universal auto-sync.
 */

import { schemaRegistry } from "../registry/eventbridge";
import { registerEventSchema } from "../registry/registration";
import {
  collectEventInstances,
  configureRegistry,
  scanForEventFiles,
} from "./shared";

async function autoSyncAllSchemas(
  options: { deleteOrphaned?: boolean } = { deleteOrphaned: true },
) {
  const startTime = Date.now();
  console.log("🔄 Auto-syncing Event schemas with registry...");

  try {
    // Configure EventBridge Schema Registry
    configureRegistry();

    // Scan for files and collect Event instances
    const files = await scanForEventFiles();
    const { events: allEvents, importedCount } =
      await collectEventInstances(files);

    if (allEvents.length === 0) {
      return;
    }

    // Get existing schemas from registry
    console.log("\n📋 Getting existing schemas from registry...");
    const existingSchemas = await schemaRegistry.listSchemas();
    const existingTypes = new Set(existingSchemas.map((s) => s.type));
    const discoveredTypes = new Set(allEvents.map((e) => e.name));

    console.log(
      `   • Found ${existingSchemas.length} existing schemas in registry`,
    );

    // Sync schemas
    let created = 0;
    let updated = 0;
    let deleted = 0;
    const errors: Array<{ type: string; error: string }> = [];

    console.log("\n🔄 Syncing schemas...");

    // Update/create discovered schemas
    for (const event of allEvents) {
      try {
        const isUpdate = existingTypes.has(event.name);
        await registerEventSchema(event);

        if (isUpdate) {
          updated++;
          console.log(`   📝 Updated: ${event.name}`);
        } else {
          created++;
          console.log(`   🆕 Created: ${event.name}`);
        }
      } catch (error) {
        errors.push({
          type: event.name,
          error: error instanceof Error ? error.message : String(error),
        });
        console.log(`   ❌ Failed: ${event.name}`);
      }
    }

    // Delete orphaned schemas if requested
    if (options.deleteOrphaned) {
      const orphanedTypes = Array.from(existingTypes).filter(
        (type) => !discoveredTypes.has(type),
      );

      if (orphanedTypes.length > 0) {
        console.log(
          `\n🗑️  Deleting ${orphanedTypes.length} orphaned schemas...`,
        );

        for (const type of orphanedTypes) {
          try {
            await schemaRegistry.deleteSchema(type);
            deleted++;
            console.log(`   🗑️  Deleted: ${type}`);
          } catch (error) {
            errors.push({
              type,
              error: `Failed to delete: ${error instanceof Error ? error.message : String(error)}`,
            });
            console.log(`   ❌ Failed to delete: ${type}`);
          }
        }
      } else {
        console.log("\n✅ No orphaned schemas found");
      }
    }

    // Summary
    const duration = Date.now() - startTime;
    console.log(`\n🎉 Auto-sync completed in ${duration}ms`);
    console.log("📊 Sync Results:");
    console.log(`   • Files scanned: ${files.length}`);
    console.log(`   • Files imported: ${importedCount}`);
    console.log(`   • Events found: ${allEvents.length}`);
    console.log(`   • 🆕 Created: ${created} schemas`);
    console.log(`   • 📝 Updated: ${updated} schemas`);
    console.log(`   • 🗑️  Deleted: ${deleted} schemas`);
    console.log(`   • ❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log("\n❌ Sync Errors:");
      for (const error of errors) {
        console.log(`   • ${error.type}: ${error.error}`);
      }
    }
  } catch (error) {
    console.error("❌ Auto-sync failed:", error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const deleteOrphaned = !args.includes("--no-delete"); // Delete by default, unless --no-delete is specified

// Run if executed directly
if (import.meta.main) {
  await autoSyncAllSchemas({ deleteOrphaned });
}

export { autoSyncAllSchemas };
