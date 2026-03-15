#!/usr/bin/env node

/**
 * Auto-Registration Script for Event Schemas
 *
 * This script automatically:
 * 1. Finds all TypeScript/JavaScript files in the project
 * 2. Dynamically imports each file (triggers Event constructors)
 * 3. Registers all Event schemas with EventBridge Schema Registry
 *
 * Works for any project structure - truly universal auto-discovery.
 */

import { registerAllEventSchemas } from "../registry/registration";
import { collectEventInstances, configureRegistry, scanForEventFiles } from "./shared";

async function autoRegisterAllSchemas() {
  const startTime = Date.now();
  console.log("🔍 Auto-discovering and registering Event schemas...");

  try {
    // Configure EventBridge Schema Registry
    configureRegistry();

    // Scan for files and collect Event instances
    const files = await scanForEventFiles();
    const { events: allEvents, importedCount, failedCount } = await collectEventInstances(files);

    if (allEvents.length === 0) {
      return;
    }

    // Register all schemas with EventBridge
    console.log("\n📝 Registering schemas with EventBridge...");
    await registerAllEventSchemas(allEvents);

    const duration = Date.now() - startTime;
    console.log(`\n🎉 Auto-registration completed in ${duration}ms`);
    console.log(`   • Files scanned: ${files.length}`);
    console.log(`   • Files imported: ${importedCount}`);
    console.log(`   • Events found: ${allEvents.length}`);
    console.log(`   • Schemas registered: ${allEvents.length}`);
  } catch (error) {
    console.error("❌ Auto-registration failed:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  await autoRegisterAllSchemas();
}

export { autoRegisterAllSchemas };
