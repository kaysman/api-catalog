/**
 * NestJS adapter for api-catalog.
 *
 * Provides our own route-documentation decorators (no @nestjs/swagger needed)
 * and a static setup function that walks the NestJS app's controller graph,
 * reads our metadata, assembles an OpenAPI spec, and mounts the catalog UI.
 *
 * Usage:
 *
 *   // users.controller.ts
 *   import { ApiOperation, ApiQuery, ApiBody, ApiResponse } from "api-catalog/nestjs";
 *
 *   @Controller("users")
 *   export class UsersController {
 *     @Get()
 *     @ApiOperation({ summary: "List users" })
 *     @ApiQuery({ name: "limit", schema: { type: "integer" }, required: false })
 *     @ApiResponse({ status: 200, description: "User list" })
 *     findAll() { ... }
 *   }
 *
 *   // main.ts
 *   import { ApiCatalogAdapter } from "api-catalog/nestjs";
 *   const app = await NestFactory.create(AppModule);
 *   ApiCatalogAdapter.setup("/docs", app);
 *   await app.listen(3000);
 */

import { mountApiCatalog } from "../express.js";
import { SpecBuilder } from "../spec/builder.js";
import type {
  SchemaObject,
  ReferenceObject,
  OperationObject,
  ParameterObject,
} from "../spec/openapi.js";

// reflect-metadata is a runtime peer dep (NestJS always loads it).
// Declare only the subset we call so tsc is happy without requiring a separate
// @types/reflect-metadata install in downstream projects.
declare const Reflect: {
  defineMetadata(
    key: string,
    value: unknown,
    target: object,
    propertyKey?: string | symbol,
  ): void;
  getMetadata(
    key: string,
    target: object,
    propertyKey?: string | symbol,
  ): unknown;
};

// ── Reflect metadata keys ─────────────────────────────────────────────────────

const KEY_OP = "catalog:operation";
const KEY_PARAMS = "catalog:params";
const KEY_BODY = "catalog:body";
const KEY_RESP = "catalog:responses";

// ── Decorator option types ────────────────────────────────────────────────────

export interface ApiOperationOptions {
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  operationId?: string;
}

export interface ApiQueryOptions {
  name: string;
  schema?: SchemaObject | ReferenceObject;
  required?: boolean;
  description?: string;
  deprecated?: boolean;
}

export interface ApiParamOptions {
  name: string;
  schema?: SchemaObject | ReferenceObject;
  description?: string;
  deprecated?: boolean;
}

export interface ApiHeaderOptions {
  name: string;
  schema?: SchemaObject | ReferenceObject;
  required?: boolean;
  description?: string;
}

export interface ApiBodyOptions {
  schema: SchemaObject | ReferenceObject;
  required?: boolean;
  description?: string;
}

export interface ApiResponseOptions {
  status: number;
  description: string;
  schema?: SchemaObject | ReferenceObject;
}

// ── Decorators ────────────────────────────────────────────────────────────────

/**
 * Document an endpoint's operation metadata (summary, description, tags).
 * Only methods annotated with @ApiOperation are included in the catalog spec.
 */
export function ApiOperation(opts: ApiOperationOptions): MethodDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata(KEY_OP, opts, target, propertyKey as string);
  };
}

/** Document a query parameter. Stack multiple decorators for multiple params. */
export function ApiQuery(opts: ApiQueryOptions): MethodDecorator {
  return (target, propertyKey) => {
    const existing =
      (Reflect.getMetadata(KEY_PARAMS, target, propertyKey as string) as ParameterObject[] | undefined) ?? [];
    Reflect.defineMetadata(
      KEY_PARAMS,
      [
        ...existing,
        {
          name: opts.name,
          in: "query",
          required: opts.required ?? false,
          ...(opts.description ? { description: opts.description } : {}),
          ...(opts.deprecated ? { deprecated: true } : {}),
          ...(opts.schema ? { schema: opts.schema } : {}),
        } satisfies ParameterObject,
      ],
      target,
      propertyKey as string,
    );
  };
}

/** Document a path parameter. Stack multiple decorators for multiple params. */
export function ApiParam(opts: ApiParamOptions): MethodDecorator {
  return (target, propertyKey) => {
    const existing =
      (Reflect.getMetadata(KEY_PARAMS, target, propertyKey as string) as ParameterObject[] | undefined) ?? [];
    Reflect.defineMetadata(
      KEY_PARAMS,
      [
        ...existing,
        {
          name: opts.name,
          in: "path",
          required: true,
          ...(opts.description ? { description: opts.description } : {}),
          ...(opts.deprecated ? { deprecated: true } : {}),
          ...(opts.schema ? { schema: opts.schema } : {}),
        } satisfies ParameterObject,
      ],
      target,
      propertyKey as string,
    );
  };
}

/** Document a request header parameter. Stack multiple decorators for multiple headers. */
export function ApiHeader(opts: ApiHeaderOptions): MethodDecorator {
  return (target, propertyKey) => {
    const existing =
      (Reflect.getMetadata(KEY_PARAMS, target, propertyKey as string) as ParameterObject[] | undefined) ?? [];
    Reflect.defineMetadata(
      KEY_PARAMS,
      [
        ...existing,
        {
          name: opts.name,
          in: "header",
          ...(opts.required !== undefined ? { required: opts.required } : {}),
          ...(opts.description ? { description: opts.description } : {}),
          ...(opts.schema ? { schema: opts.schema } : {}),
        } satisfies ParameterObject,
      ],
      target,
      propertyKey as string,
    );
  };
}

/** Document the JSON request body. */
export function ApiBody(opts: ApiBodyOptions): MethodDecorator {
  return (target, propertyKey) => {
    Reflect.defineMetadata(KEY_BODY, opts, target, propertyKey as string);
  };
}

/**
 * Document a response status. Stack multiple decorators for multiple statuses.
 * If no @ApiResponse is provided, the operation gets no documented responses.
 */
export function ApiResponse(opts: ApiResponseOptions): MethodDecorator {
  return (target, propertyKey) => {
    const existing =
      (Reflect.getMetadata(KEY_RESP, target, propertyKey as string) as Record<number, ApiResponseOptions> | undefined) ?? {};
    Reflect.defineMetadata(
      KEY_RESP,
      { ...existing, [opts.status]: opts },
      target,
      propertyKey as string,
    );
  };
}

// ── NestJS HTTP method enum (stable across v8/v9/v10) ────────────────────────

const NEST_METHOD: Record<number, string> = {
  0: "get",
  1: "post",
  2: "put",
  3: "delete",
  4: "patch",
  5: "all",
  6: "options",
  7: "head",
};

// ── Adapter setup ─────────────────────────────────────────────────────────────

/** Minimal duck-type: the only surface we need from INestApplication. */
interface NestApp {
  getHttpAdapter(): { getInstance(): unknown };
}

export interface ApiCatalogAdapterOptions {
  title?: string;
  serverUrl?: string;
  version?: string;
  /** Component schemas to register, referenced via s.ref("Name") in decorators. */
  schemas?: Record<string, SchemaObject | ReferenceObject>;
}

/**
 * Walk the NestJS module graph, collect all methods decorated with
 * @ApiOperation, assemble an OpenAPI spec, and mount the catalog.
 *
 *   ApiCatalogAdapter.setup("/docs", app);
 *   ApiCatalogAdapter.setup("/docs", app, { title: "My API", serverUrl: "https://api.example.com" });
 */
export class ApiCatalogAdapter {
  static setup(
    basePath: string,
    app: NestApp,
    opts: ApiCatalogAdapterOptions = {},
  ): void {
    const container = (app as unknown as Record<string, unknown>)["container"] as {
      getModules(): Map<
        string,
        {
          controllers: Map<
            string,
            { metatype: unknown; instance: unknown }
          >;
        }
      >;
    } | undefined;

    if (!container) {
      throw new Error(
        "[api-catalog] Could not access the NestJS container. " +
        "Ensure ApiCatalogAdapter.setup() is called after NestFactory.create().",
      );
    }

    const builder = new SpecBuilder()
      .title(opts.title ?? "API")
      .version(opts.version ?? "1.0.0");

    if (opts.serverUrl) {
      builder.server(opts.serverUrl);
    }

    if (opts.schemas) {
      for (const [name, schema] of Object.entries(opts.schemas)) {
        builder.schema(name, schema);
      }
    }

    for (const [, nestModule] of container.getModules()) {
      for (const [, wrapper] of nestModule.controllers) {
        if (!wrapper.instance || !wrapper.metatype) continue;

        const metatype = wrapper.metatype as object;
        const instance = wrapper.instance as object;
        const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;

        // Controller path prefix (from @Controller("users"))
        const controllerPath: string =
          (Reflect.getMetadata("path", metatype) as string | undefined) ?? "";

        for (const methodName of Object.getOwnPropertyNames(proto)) {
          if (methodName === "constructor") continue;
          const method = proto[methodName];
          if (typeof method !== "function") continue;

          // NestJS stores route metadata on the handler function itself
          // (descriptor.value), not on (prototype, methodName).
          const routePath: string | undefined = Reflect.getMetadata(
            "path",
            method,
          ) as string | undefined;
          const httpMethodNum: number | undefined = Reflect.getMetadata(
            "method",
            method,
          ) as number | undefined;

          if (routePath === undefined || httpMethodNum === undefined) continue;

          // Only include methods explicitly documented with @ApiOperation
          const opMeta: ApiOperationOptions | undefined = Reflect.getMetadata(
            KEY_OP,
            proto,
            methodName,
          ) as ApiOperationOptions | undefined;
          if (!opMeta) continue;

          const httpMethod = NEST_METHOD[httpMethodNum];
          if (!httpMethod || httpMethod === "all") continue;

          // Normalise path: /users + /:id → /users/:id
          const fullPath =
            "/" +
            [controllerPath, routePath]
              .map((p) => String(p).replace(/^\/|\/$/g, ""))
              .filter(Boolean)
              .join("/");

          // Collect our decorator metadata
          const params: ParameterObject[] =
            (Reflect.getMetadata(KEY_PARAMS, proto, methodName) as
              | ParameterObject[]
              | undefined) ?? [];

          const bodyMeta: ApiBodyOptions | undefined = Reflect.getMetadata(
            KEY_BODY,
            proto,
            methodName,
          ) as ApiBodyOptions | undefined;

          const responsesMeta: Record<number, ApiResponseOptions> =
            (Reflect.getMetadata(KEY_RESP, proto, methodName) as
              | Record<number, ApiResponseOptions>
              | undefined) ?? {};

          const operation: OperationObject = {
            ...(opMeta.summary ? { summary: opMeta.summary } : {}),
            ...(opMeta.description ? { description: opMeta.description } : {}),
            ...(opMeta.tags?.length ? { tags: opMeta.tags } : {}),
            ...(opMeta.deprecated ? { deprecated: true } : {}),
            ...(opMeta.operationId ? { operationId: opMeta.operationId } : {}),
            ...(params.length ? { parameters: params } : {}),
            ...(bodyMeta
              ? {
                  requestBody: {
                    required: bodyMeta.required ?? true,
                    ...(bodyMeta.description
                      ? { description: bodyMeta.description }
                      : {}),
                    content: { "application/json": { schema: bodyMeta.schema } },
                  },
                }
              : {}),
            responses: Object.fromEntries(
              Object.entries(responsesMeta).map(([status, r]) => [
                status,
                {
                  description: r.description,
                  ...(r.schema
                    ? { content: { "application/json": { schema: r.schema } } }
                    : {}),
                },
              ]),
            ),
          };

          builder.addRoute(
            httpMethod as import("../spec/openapi.js").HttpMethod,
            fullPath,
            operation,
          );
        }
      }
    }

    const document = builder.build();
    const expressApp = app.getHttpAdapter().getInstance();

    mountApiCatalog(
      expressApp as Parameters<typeof mountApiCatalog>[0],
      {
        basePath,
        title: opts.title,
        serverUrl: opts.serverUrl,
        scopes: [{ id: "default", label: opts.title ?? "API", document }],
      },
    );
  }
}
