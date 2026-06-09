import type { SchemaObject, ReferenceObject } from "./openapi.js";

export type Schema = SchemaObject | ReferenceObject;

/**
 * Ergonomic schema builder helpers. Use these instead of writing raw OpenAPI
 * schema objects:
 *
 *   s.object({ name: s.string(), age: s.integer() }, ["name"])
 *   s.array(s.ref("User"))
 *   s.string({ format: "uuid" })
 */
export const s = {
  string(opts: Omit<SchemaObject, "type"> = {}): SchemaObject {
    return { type: "string", ...opts };
  },

  number(opts: Omit<SchemaObject, "type"> = {}): SchemaObject {
    return { type: "number", ...opts };
  },

  integer(opts: Omit<SchemaObject, "type"> = {}): SchemaObject {
    return { type: "integer", ...opts };
  },

  boolean(opts: Omit<SchemaObject, "type"> = {}): SchemaObject {
    return { type: "boolean", ...opts };
  },

  array(
    items: Schema,
    opts: Omit<SchemaObject, "type" | "items"> = {},
  ): SchemaObject {
    return { type: "array", items, ...opts };
  },

  object(
    properties: Record<string, Schema>,
    required?: string[],
    opts: Omit<SchemaObject, "type" | "properties" | "required"> = {},
  ): SchemaObject {
    return {
      type: "object",
      properties,
      ...(required && required.length > 0 ? { required } : {}),
      ...opts,
    };
  },

  /** Reference to a named schema in components/schemas. */
  ref(name: string): ReferenceObject {
    return { $ref: `#/components/schemas/${name}` };
  },

  /** Wrap any schema to allow null values (OpenAPI 3.0 style). */
  nullable(schema: SchemaObject): SchemaObject {
    return { ...schema, nullable: true };
  },

  /** String schema constrained to a fixed set of values. */
  enum(
    values: string[],
    opts: Omit<SchemaObject, "type" | "enum"> = {},
  ): SchemaObject {
    return { type: "string", enum: values, ...opts };
  },

  oneOf(schemas: Schema[]): SchemaObject {
    return { oneOf: schemas };
  },

  anyOf(schemas: Schema[]): SchemaObject {
    return { anyOf: schemas };
  },

  allOf(schemas: Schema[]): SchemaObject {
    return { allOf: schemas };
  },
};
