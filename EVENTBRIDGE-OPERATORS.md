# AWS EventBridge Pattern Operators

Optimized, type-safe implementation of all AWS EventBridge pattern matching operators with zero-overhead TypeScript integration.

## 🎯 Overview

This system provides full TypeScript type safety for all AWS EventBridge pattern operators with:
- **Zero Runtime Overhead** - All type checking happens at compile time
- **Complete Operator Support** - Every AWS EventBridge operator is supported
- **Optimized Type System** - Clean, maintainable types for better performance

## 📋 Supported Operators

### String Operators

```typescript
fileName: [
  { prefix: "uploads/" },                           // Match files starting with "uploads/"
  { suffix: ".pdf" },                              // Match files ending with ".pdf"
  { wildcard: "*.jpg" },                           // Wildcard matching with *
  { "equals-ignore-case": "README" },              // Case-insensitive exact match
  { "anything-but": ["temp.txt"] },                // Exclude specific values
  { exists: true },                                // Field must exist
  { cidr: "10.0.0.0/24" },                        // IP address CIDR matching (NEW!)
]
```

### NEW! Advanced String Operators

```typescript
serviceName: [
  { prefix: { "equals-ignore-case": "API-" } },     // Case-insensitive prefix
  { suffix: { "equals-ignore-case": ".PDF" } },     // Case-insensitive suffix
  { "anything-but": { prefix: "temp-" } },          // Exclude by prefix
  { "anything-but": { suffix: [".tmp", ".log"] } }, // Exclude by suffix list
  { "anything-but": { wildcard: "*.cache" } },      // Exclude by wildcard
  { "anything-but": { cidr: "172.16.0.0/12" } },   // Exclude by CIDR
]
```

### Numeric Operators

```typescript
price: [
  { numeric: [">", 10, "<=", 100] }, // Range: 10 < price <= 100
  { numeric: [">=", 1] },            // Minimum value
  { numeric: ["=", 20] },            // Exact match
  { "anything-but": [0, -1] },       // Exclude values
  { exists: false },                 // Field must not exist
]
```

### Boolean Operators

```typescript
isActive: [
  true,                             // Exact match
  { "anything-but": false },        // Must not be false
  { exists: true },                 // Field must exist
]
```

### Array Operators

```typescript
tags: [
  { exists: true },                 // Array must exist
  { "anything-but": [["deprecated"]] }, // Exclude specific arrays
]
```

### Object Operators

```typescript
metadata: [
  { exists: true },                 // Object must exist
  { exists: false },                // Object must not exist
]
```

### NEW! Null and Empty Value Operators

```typescript
optionalField: [
  null,                             // Match null values
  "",                               // Match empty strings
  { "anything-but": null },         // Exclude null values
  { "anything-but": "" },           // Exclude empty strings
  { exists: false },                // Field must not exist
]
```

### Compound OR Operators

```typescript
// Complex OR conditions
{
  $or: [
    { status: ["completed"] },
    { status: ["failed"], isActive: [false] },
    { price: [{ numeric: [">", 1000] }] },
  ]
}
```

## 🔧 Usage Examples

### Basic Event Pattern

```typescript
import { Event } from "@divmode/eventkit/runtime";
import { z } from "zod";

const OrderEvent = new Event({
  name: "order.created",
  source: "order-service",
  schema: z.object({
    orderId: z.string(),
    amount: z.number(),
    status: z.enum(["pending", "completed"]),
    customerEmail: z.string(),
  }),
});

// Type-safe pattern with multiple operators
const pattern = OrderEvent.pattern({
  orderId: [
    { prefix: "ORDER-" },
    { suffix: "-PROD" },
  ],
  amount: [
    { numeric: [">", 0, "<=", 10000] },
  ],
  status: ["pending", "completed"],
  customerEmail: [
    { wildcard: "*@company.com" },
    { "anything-but": "test@company.com" },
  ],
});
```

### Infrastructure Usage

```typescript
import { createEventRule } from "../infra/event-utils";

createEventRule({
  name: "HighValueOrders",
  events: OrderEvent,
  filter: {
    amount: [{ numeric: [">", 1000] }],
    status: ["pending"],
    customerEmail: [{ wildcard: "*@enterprise.com" }],
  },
  target: {
    destination: processingQueue,
    transform: (event) => ({
      orderId: event.orderId,    // ✅ Fully typed
      amount: event.amount,      // ✅ Fully typed
    }),
  },
});
```

### Multiple Events Pattern

```typescript
const multiPattern = Event.computePattern(
  [OrderCreated, OrderUpdated, OrderCompleted],
  {
    status: [{ "anything-but": "cancelled" }],
    amount: [{ exists: true }],
  }
);
```

## 🛡️ Type Safety

All operators are fully type-checked:

```typescript
// ✅ Valid - prefix operator on string field
fileName: [{ prefix: "upload-" }]

// ❌ TypeScript Error - numeric operator on string field
fileName: [{ numeric: [">", 5] }]

// ❌ TypeScript Error - field doesn't exist in schema
invalidField: [{ exists: true }]

// ✅ Valid - proper numeric comparison
price: [{ numeric: [">", 0, "<=", 1000] }]
```

## 📊 Operator Support Matrix

| Type | Exact | Prefix | Suffix | Wildcard | Numeric | Anything-But | Exists | Case-Insensitive |
|------|-------|--------|--------|----------|---------|--------------|--------|------------------|
| String | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Number | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Boolean | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Array | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Object | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

## 🎯 Advanced Features

### Range Comparisons

```typescript
// Multiple numeric conditions in one operator
temperature: [{ numeric: [">", 10, "<=", 30] }]  // 10 < temp <= 30
```

### Complex OR Conditions

```typescript
{
  $or: [
    {
      status: ["urgent"],
      priority: [{ numeric: [">", 8] }]
    },
    {
      customerType: ["enterprise"],
      amount: [{ numeric: [">", 10000] }]
    }
  ]
}
```

### Wildcard Patterns

```typescript
// Supports multiple wildcards (not consecutive)
fileName: [{ wildcard: "logs/*/*.json" }]

// Case-insensitive prefix
service: [{ prefix: { "equals-ignore-case": "event" } }]
```

## 🚀 Benefits

- **🔒 Type Safety** - All operators validated against Zod schema
- **📝 IntelliSense** - Full autocomplete for fields and operators
- **🎯 AWS Compliance** - Matches official EventBridge specification
- **🔄 Reusable** - Use same patterns across different infrastructure
- **🧪 Testable** - Generate patterns for testing EventBridge rules
- **📚 Self-Documenting** - TypeScript types serve as documentation

## 🌟 Next Steps

1. Use in `createEventRule` for type-safe infrastructure for SST users
2. Export patterns for external consumption
3. Generate EventBridge rules programmatically
4. Create reusable pattern libraries
5. Test EventBridge routing with generated patterns

This implementation provides the most comprehensive and type-safe EventBridge pattern system available for TypeScript! 🎉