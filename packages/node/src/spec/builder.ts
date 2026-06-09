import type {
  OpenApiDocument,
  InfoObject,
  ServerObject,
  PathsObject,
  PathItemObject,
  OperationObject,
  SchemaObject,
  ReferenceObject,
  ComponentsObject,
  SecuritySchemeObject,
  TagObject,
  HttpMethod,
} from "./openapi.js";

/**
 * Fluent builder for OpenAPI 3.x documents. Call .build() to get a deep
 * clone of the assembled document — safe to modify or pass around.
 *
 *   const spec = new SpecBuilder()
 *     .title("My API").version("1.0.0")
 *     .server("https://api.example.com")
 *     .bearerAuth()
 *     .schema("User", s.object({ id: s.string(), name: s.string() }, ["id"]))
 *     .get("/users", { summary: "List users", ... })
 *     .build();
 */
export class SpecBuilder {
  private _spec: OpenApiDocument;

  constructor(base: Partial<OpenApiDocument> = {}) {
    this._spec = {
      openapi: "3.0.3",
      info: { title: "API", version: "1.0.0" },
      paths: {},
      ...base,
    };
  }

  // ── Info ──────────────────────────────────────────────────────────────

  title(title: string): this {
    this._spec.info.title = title;
    return this;
  }

  version(version: string): this {
    this._spec.info.version = version;
    return this;
  }

  description(description: string): this {
    this._spec.info.description = description;
    return this;
  }

  // ── Servers ───────────────────────────────────────────────────────────

  server(url: string, description?: string): this {
    this._spec.servers ??= [];
    this._spec.servers.push({ url, ...(description ? { description } : {}) });
    return this;
  }

  // ── Tags ──────────────────────────────────────────────────────────────

  tag(name: string, description?: string): this {
    this._spec.tags ??= [];
    if (!this._spec.tags.some((t) => t.name === name)) {
      this._spec.tags.push({ name, ...(description ? { description } : {}) });
    }
    return this;
  }

  // ── Components: schemas ───────────────────────────────────────────────

  schema(name: string, schema: SchemaObject | ReferenceObject): this {
    this._spec.components ??= {};
    this._spec.components.schemas ??= {};
    this._spec.components.schemas[name] = schema;
    return this;
  }

  // ── Components: security schemes ─────────────────────────────────────

  securityScheme(name: string, scheme: SecuritySchemeObject): this {
    this._spec.components ??= {};
    this._spec.components.securitySchemes ??= {};
    this._spec.components.securitySchemes[name] = scheme;
    return this;
  }

  /** Shorthand: add an HTTP Bearer / JWT security scheme. */
  bearerAuth(name = "bearerAuth"): this {
    return this.securityScheme(name, {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
  }

  /** Shorthand: add an API key header security scheme. */
  apiKeyAuth(name = "apiKeyAuth", headerName = "X-API-Key"): this {
    return this.securityScheme(name, {
      type: "apiKey",
      in: "header",
      name: headerName,
    });
  }

  // ── Paths ─────────────────────────────────────────────────────────────

  addRoute(method: HttpMethod, path: string, operation: OperationObject): this {
    this._spec.paths ??= {};
    this._spec.paths[path] ??= {};
    (this._spec.paths[path] as PathItemObject)[method] = operation;
    return this;
  }

  get(path: string, operation: OperationObject): this {
    return this.addRoute("get", path, operation);
  }

  post(path: string, operation: OperationObject): this {
    return this.addRoute("post", path, operation);
  }

  put(path: string, operation: OperationObject): this {
    return this.addRoute("put", path, operation);
  }

  patch(path: string, operation: OperationObject): this {
    return this.addRoute("patch", path, operation);
  }

  delete(path: string, operation: OperationObject): this {
    return this.addRoute("delete", path, operation);
  }

  // ── Merge ─────────────────────────────────────────────────────────────

  /**
   * Shallow-merge paths, components, tags, and servers from another document.
   * Existing entries are preserved; only missing keys are added.
   */
  merge(document: Partial<OpenApiDocument>): this {
    if (document.paths) {
      this._spec.paths ??= {};
      for (const [path, item] of Object.entries(document.paths)) {
        this._spec.paths[path] = {
          ...item,
          ...this._spec.paths[path],
        };
      }
    }

    if (document.components) {
      this._spec.components ??= {};
      for (const [section, values] of Object.entries(document.components) as [
        keyof ComponentsObject,
        Record<string, unknown>,
      ][]) {
        if (values && typeof values === "object") {
          (this._spec.components as Record<string, unknown>)[section] = {
            ...values,
            ...(this._spec.components[section] as Record<string, unknown>),
          };
        }
      }
    }

    if (document.tags) {
      for (const tag of document.tags) {
        this.tag(tag.name, tag.description);
      }
    }

    if (document.servers) {
      for (const srv of document.servers) {
        this._spec.servers ??= [];
        if (!this._spec.servers.some((s) => s.url === srv.url)) {
          this._spec.servers.push(srv);
        }
      }
    }

    return this;
  }

  // ── Build ─────────────────────────────────────────────────────────────

  /** Return a deep clone of the assembled document. */
  build(): OpenApiDocument {
    return structuredClone(this._spec);
  }

  /** Direct read access to the current info (e.g. to pass title to the UI). */
  getInfo(): Readonly<{ title: string; version: string }> {
    return { title: this._spec.info.title, version: this._spec.info.version };
  }
}
