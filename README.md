# EventKit

**Type-safe AWS EventBridge patterns from Zod schemas**

[![npm version](https://img.shields.io/npm/v/@divmode/eventkit.svg)](https://www.npmjs.com/package/@divmode/eventkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![AWS EventBridge](https://img.shields.io/badge/AWS-EventBridge-orange.svg)](https://aws.amazon.com/eventbridge/)

Generate type-safe AWS EventBridge patterns with zero runtime overhead. Transform your existing Zod schemas into EventBridge rules with complete TypeScript safety and IntelliSense support.

## ✨ Key Features

- **🔒 Complete Type Safety** - Full TypeScript IntelliSense for EventBridge operators
- **⚡ Zero Runtime Overhead** - All validation happens at compile time
- **🌍 Universal Compatibility** - Works with AWS SDK, CDK, Terraform, SST, any tool
- **🎯 100% EventBridge Compliance** - Supports all official AWS EventBridge operators
- **📋 AWS Schema Registry Integration** - Auto-discover and sync schemas with EventBridge
- **🚀 SST Infrastructure Helpers** - First-class support for SST with type-safe infrastructure utilities

## 📦 Installation

```bash
npm install @divmode/eventkit zod
# or
yarn add @divmode/eventkit zod
# or
bun add @divmode/eventkit zod
```

## ⚙️ Configuration

EventKit works in two modes:

### 🏗️ SST Context (Monorepo)
In SST projects, EventKit automatically uses your configured EventBridge bus:
```typescript
// No additional configuration needed - uses Resource.Bus
const OrderCreated = new Event({ bus: createEventBus, ... });
```

### 🌍 Standalone Context (npm package)
When using EventKit as a standalone package, configure via environment variables:

```bash
# Required for event publishing
export EVENTKIT_BUS_NAME="my-event-bus"

# Optional - AWS region (defaults to AWS SDK defaults)
export AWS_REGION="us-east-1"

# AWS credentials (choose one method):

# Method 1: Environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"

# Method 2: AWS Profile
export AWS_PROFILE="your-profile-name"

# Method 3: IAM Role (automatic in AWS environments)
# No additional config needed when running on EC2, Lambda, ECS

# Method 4: Shared credentials file (~/.aws/credentials)
# Automatically detected by AWS SDK
```

**📋 Note**: Pattern generation and type safety work without any configuration. Environment variables are only needed when actually publishing events to EventBridge.

## 🚀 Quick Start

### 1. Define Events

```typescript
import { Event, createEventBus } from "@divmode/eventkit/runtime";
import { z } from "zod";

const OrderCreated = new Event({
  name: "order.created",
  source: "order-service",
  bus: createEventBus, // 👈 Lazy factory - bus only created when publishing
  schema: z.object({
    orderId: z.string(),
    amount: z.number(),
    customerTier: z.enum(["basic", "premium", "enterprise"]),
  }),
});

// The lazy pattern enables powerful cross-workspace usage:

// ✅ In workers/functions - validate incoming events
const parsed = OrderCreated.schema.parse(event.detail.properties);

// ✅ In infrastructure - generate patterns without AWS connection
const pattern = OrderCreated.pattern({ amount: [{ numeric: [">", 100] }] });

// ✅ In type definitions - extract types
type OrderData = z.infer<typeof OrderCreated.schema>;

// ✅ Only when publishing is the bus needed (requires config)
await OrderCreated.publish({
  orderId: "ORDER-123",
  amount: 1500,
  customerTier: "premium"
}); // Bus created here - needs EVENTKIT_BUS_NAME or SST context
```

### 2. Generate Type-Safe Patterns

```typescript
const pattern = OrderCreated.pattern({
  orderId: [{ prefix: "ORDER-" }],         // ✅ String operators
  amount: [{ numeric: [">", 1000] }],      // ✅ Numeric operators
  customerTier: ["premium", "enterprise"], // ✅ Enum validation
});

console.log(JSON.stringify(pattern, null, 2));
// {
//   "source": ["order-service"],
//   "detail-type": ["order.created"],
//   "detail": {
//     "properties": {
//       "orderId": [{ "prefix": "ORDER-" }],
//       "amount": [{ "numeric": [">", 1000] }],
//       "customerTier": ["premium", "enterprise"]
//     }
//   }
// }
```

### 3. Cross-Workspace Event Usage

The lazy bus pattern enables Events to be imported anywhere without AWS setup:

```typescript
// packages/core/events.ts - Define once
export const OrderCreated = new Event({
  name: "order.created",
  bus: () => new Bus({ ... }), // Lazy factory
  schema: z.object({ orderId: z.string(), amount: z.number() })
});

// packages/workers/handler.ts - Validate incoming events
import { OrderCreated } from "@company/core/events";

export default {
  async queue(batch) {
    for (const message of batch.messages) {
      // Use schema for validation
      const order = OrderCreated.schema.parse(message.body);
      console.log(`Processing order ${order.orderId}`);
    }
  }
}

// packages/functions/processor.ts - Type safety
import { OrderCreated } from "@company/core/events";

type Order = z.infer<typeof OrderCreated.schema>; // Extract type

function processOrder(order: Order) {
  // Full type safety without AWS connection
}

// infra/rules.ts - Pattern generation
import { OrderCreated } from "@company/core/events";

const pattern = OrderCreated.pattern({
  amount: [{ numeric: [">", 1000] }]
}); // No AWS needed for patterns
```

### 4. Use with Any Infrastructure Tool

#### AWS SDK
```typescript
import { EventBridgeClient, PutRuleCommand } from "@aws-sdk/client-eventbridge";

const client = new EventBridgeClient({});
await client.send(new PutRuleCommand({
  Name: "HighValueOrders",
  EventPattern: JSON.stringify(pattern),
  Targets: [{ Id: "1", Arn: "arn:aws:sqs:region:account:queue" }]
}));
```

#### AWS CDK
```typescript
import { Rule } from 'aws-cdk-lib/aws-events';

new Rule(this, 'HighValueOrders', {
  eventPattern: pattern,
  targets: [new SqsQueue(myQueue)]
});
```

#### Terraform
```hcl
resource "aws_cloudwatch_event_rule" "high_value_orders" {
  name          = "HighValueOrders"
  event_pattern = jsonencode(${generated_pattern})
}
```

## 📋 Schema Registry Integration

EventKit automatically discovers and syncs your events with AWS EventBridge Schema Registry:

```bash
# Discover and register all schemas
npx @divmode/eventkit register-schemas

# Sync schemas (add new, update changed, remove orphaned)
npx @divmode/eventkit sync-schemas
```

Your Event definitions become the source of truth for your event contracts across teams.

## 🤔 Why EventKit?

**Problem:** EventBridge patterns are complex JSON structures that are error-prone and lack type safety.

```typescript
// ❌ Error-prone, no IntelliSense, runtime failures
const pattern = {
  "detail": {
    "properties": {
      "amout": [{ "numeric": [">", 1000] }], // Typo!
      "status": ["PENDING"] // Wrong enum value!
    }
  }
};
```

**Solution:** Generate patterns from your existing Zod schemas with full type safety.

```typescript
// ✅ Type-safe, IntelliSense, compile-time validation
const pattern = OrderCreated.pattern({
  amount: [{ numeric: [">", 1000] }],    // ✅ Correct field name
  status: ["pending"]                    // ✅ Validated enum value
});
```

## 📚 Core Concepts

### Event Definition
```typescript
const UserRegistered = new Event({
  name: "user.registered",     // Event name (detail-type)
  source: "auth-service",      // Event source
  bus: createBus,             // Bus factory function
  schema: UserSchema          // Zod validation schema
});
```

### Pattern Generation
```typescript
// Single event patterns
const pattern = UserRegistered.pattern({
  email: [{ suffix: "@company.com" }],
  role: ["admin", "manager"]
});

// Multi-event patterns
const multiPattern = Event.computePattern([UserCreated, UserUpdated], {
  $or: [
    { role: ["admin"] },
    { permissions: [{ exists: true }] }
  ]
});
```

### EventBridge Operators

EventKit supports all AWS EventBridge operators with full type safety:

```typescript
const pattern = MyEvent.pattern({
  // String operators
  fileName: [
    { prefix: "uploads/" },
    { suffix: ".pdf" },
    { wildcard: "*.jpg" },
    { "equals-ignore-case": "README" },
    { "anything-but": ["temp.txt"] }
  ],

  // Numeric operators
  price: [
    { numeric: [">", 10, "<=", 100] }, // Range: 10 < price <= 100
    { numeric: [">=", 1] }             // Minimum value
  ],

  // Advanced operators
  ipAddress: [{ cidr: "10.0.0.0/24" }],
  tags: [{ exists: true }],

  // Complex conditions
  $or: [
    { status: ["urgent"] },
    { priority: [{ numeric: [">", 8] }] }
  ]
});
```

**📋 [Complete operator reference →](./EVENTBRIDGE-OPERATORS.md)**

## 🧪 Event Handlers

Create type-safe Lambda handlers for EventBridge events:

```typescript
import { createEventHandler } from "@divmode/eventkit/runtime";

export const handler = createEventHandler(
  [OrderCreated, OrderUpdated],
  async (event) => {
    switch (event.type) {
      case "order.created":
        // event.properties is fully typed!
        const { orderId, amount } = event.properties;
        await processNewOrder({ orderId, amount });
        break;

      case "order.updated":
        await updateOrder(event.properties);
        break;
    }
  }
);
```

## 🔧 CLI Tools

### Auto-register Schemas
Scan your codebase and register Event schemas with AWS EventBridge Schema Registry:

```bash
npx @divmode/eventkit register-schemas
```

### Auto-sync Schemas
Sync schemas with EventBridge (creates, updates, removes orphaned):

```bash
npx @divmode/eventkit sync-schemas

# Keep orphaned schemas
npx @divmode/eventkit sync-schemas --no-delete
```

## 🎯 API Reference

### Event Class

**`pattern(filter?)`** - Generate EventBridge pattern from your schema
Returns EventBridge-compatible JSON pattern for creating rules

**`publish(properties)`** - Publish event to EventBridge
Validates against schema and returns AWS response with EventId

**`create(properties)`** - Create event entry for batch publishing
Returns PutEventsRequestEntry for batch operations

**`Event.computePattern(events[], filter?)`** - Multi-event patterns
Generate single pattern matching multiple event types

### Type Helpers

```typescript
// Extract filter type from Event
type OrderFilter = FilterFor<typeof OrderCreated>;

// Extract schema type from Event
type OrderSchema = SchemaFor<typeof OrderCreated>;
```

## ⚙️ Requirements

- **Node.js** >= 18.0.0
- **TypeScript** >= 4.9.0
- **Zod** >= 4.0.0 (peer dependency)

## 🏗️ Advanced: SST Integration

EventKit includes special helpers for [SST](https://sst.dev) projects:

```typescript
import { createEventRule } from "@divmode/eventkit/sst";

// Automatic resource wiring with SST
createEventRule(OrderCreated, {
  name: "ProcessHighValueOrders",
  bus: myEventBus,
  filter: { amount: [{ numeric: [">", 1000] }] },
  target: {
    destination: processingQueue,
    transform: (event) => ({
      orderId: event.orderId, // ✅ Fully typed
      amount: event.amount,
    }),
  },
});
```

**Note:** SST integration requires the SST runtime context.

## 🌟 Real-World Example

```typescript
// Define events
const OrderCreated = new Event({
  name: "order.created",
  source: "ecommerce-api",
  schema: z.object({
    orderId: z.string(),
    amount: z.number(),
    customerTier: z.enum(["basic", "premium", "enterprise"]),
    items: z.array(z.string()),
  })
});

// Business rules as type-safe patterns
const highValuePattern = OrderCreated.pattern({
  amount: [{ numeric: [">", 1000] }],
  customerTier: ["premium", "enterprise"]
});

const enterprisePattern = OrderCreated.pattern({
  customerTier: ["enterprise"],
  items: [{ exists: true }]
});

// Use with any infrastructure tool
await createEventBridgeRule("HighValueOrders", highValuePattern);
await createEventBridgeRule("EnterpriseOrders", enterprisePattern);
```

## 🤝 Contributing

EventKit is open source! Contributions are welcome.

- **Issues**: [github.com/divmode/eventkit/issues](https://github.com/divmode/eventkit/issues)
- **Pull Requests**: [github.com/divmode/eventkit/pulls](https://github.com/divmode/eventkit/pulls)

## 📄 License

MIT © [Divmode](https://github.com/divmode)

---

**Ready to build type-safe, scalable event-driven architectures!** 🚀