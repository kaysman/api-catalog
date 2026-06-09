import type { Request, Response, RequestHandler } from "express";
import { renderCatalogHtml } from "../render.js";
import { SpecBuilder } from "../spec/builder.js";
import type {
  OperationObject,
  SchemaObject,
  ReferenceObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
} from "../spec/openapi.js";

/** The minimal route-surface shared by Express `app` and `Router`. */
interface Mountable {
  get(path: string, ...handlers: RequestHandler[]): unknown;
  post(path: string, ...handlers: RequestHandler[]): unknown;
  put(path: string, ...handlers: RequestHandler[]): unknown;
  patch(path: string, ...handlers: RequestHandler[]): unknown;
  delete(path: string, ...handlers: RequestHandler[]): unknown;
}

export interface ExpressCatalogOptions {
  /** Base path for the catalog UI and spec. Default: "/api/docs" */
  basePath?: string;
  /** Page and sidebar title. Default: "API Catalog" */
  title?: string;
  /** API version string used in the generated spec. Default: "1.0.0" */
  version?: string;
  /** Origin the "Try it" console sends requests to. */
  serverUrl?: string;
  /** Label shown on the scope toggle button. Default: same as title */
  scopeLabel?: string;
  /** URL-safe id for the generated scope. Default: "default" */
  scopeId?: string;
}

type Schema = SchemaObject | ReferenceObject;

function isOperationObject(val: unknown): val is OperationObject {
  return typeof val === "object" && val !== null;
}

/**
 * Code-first Express adapter. Register routes with inline documentation, then
 * call `.mount()` to serve the catalog UI and the generated OpenAPI spec.
 *
 *   const catalog = new ExpressApiCatalog(app, { title: "My API" });
 *
 *   catalog.get("/users", {
 *     summary: "List users",
 *     parameters: [catalog.queryParam("limit", s.integer())],
 *     responses: { 200: catalog.jsonResponse("Users", s.array(s.ref("User"))) },
 *   }, listUsersHandler);
 *
 *   catalog.spec.schema("User", s.object({ id: s.string() }, ["id"]));
 *   catalog.mount();
 */
export class ExpressApiCatalog {
  private _builder: SpecBuilder;
  private _basePath: string;
  private _title: string;
  private _scopeLabel: string;
  private _scopeId: string;
  private _serverUrl: string | undefined;

  constructor(private _app: Mountable, opts: ExpressCatalogOptions = {}) {
    this._basePath = opts.basePath ?? "/api/docs";
    this._title = opts.title ?? "API Catalog";
    this._scopeLabel = opts.scopeLabel ?? this._title;
    this._scopeId = opts.scopeId ?? "default";
    this._serverUrl = opts.serverUrl;

    this._builder = new SpecBuilder()
      .title(this._title)
      .version(opts.version ?? "1.0.0");
  }

  // ── Direct spec access ────────────────────────────────────────────────

  /** Access the underlying SpecBuilder to add schemas, security schemes, etc. */
  get spec(): SpecBuilder {
    return this._builder;
  }

  // ── Parameter / body / response helpers ───────────────────────────────

  queryParam(
    name: string,
    schema: Schema,
    opts: Partial<Omit<ParameterObject, "name" | "in" | "schema">> = {},
  ): ParameterObject {
    return { name, in: "query", schema, required: false, ...opts };
  }

  pathParam(
    name: string,
    schema: Schema,
    opts: Partial<Omit<ParameterObject, "name" | "in" | "schema">> = {},
  ): ParameterObject {
    return { name, in: "path", schema, required: true, ...opts };
  }

  headerParam(
    name: string,
    schema: Schema,
    opts: Partial<Omit<ParameterObject, "name" | "in" | "schema">> = {},
  ): ParameterObject {
    return { name, in: "header", schema, ...opts };
  }

  jsonBody(schema: Schema, description?: string): RequestBodyObject {
    return {
      required: true,
      ...(description ? { description } : {}),
      content: { "application/json": { schema } },
    };
  }

  jsonResponse(description: string, schema?: Schema): ResponseObject {
    return {
      description,
      ...(schema ? { content: { "application/json": { schema } } } : {}),
    };
  }

  // ── Route registration ────────────────────────────────────────────────

  get(path: string, operation: OperationObject, ...handlers: RequestHandler[]): this;
  get(path: string, ...handlers: RequestHandler[]): this;
  get(
    path: string,
    opOrHandler: OperationObject | RequestHandler,
    ...rest: RequestHandler[]
  ): this {
    if (isOperationObject(opOrHandler)) {
      this._builder.get(path, opOrHandler);
      this._app.get(path, ...rest);
    } else {
      this._app.get(path, opOrHandler, ...rest);
    }
    return this;
  }

  post(path: string, operation: OperationObject, ...handlers: RequestHandler[]): this;
  post(path: string, ...handlers: RequestHandler[]): this;
  post(
    path: string,
    opOrHandler: OperationObject | RequestHandler,
    ...rest: RequestHandler[]
  ): this {
    if (isOperationObject(opOrHandler)) {
      this._builder.post(path, opOrHandler);
      this._app.post(path, ...rest);
    } else {
      this._app.post(path, opOrHandler, ...rest);
    }
    return this;
  }

  put(path: string, operation: OperationObject, ...handlers: RequestHandler[]): this;
  put(path: string, ...handlers: RequestHandler[]): this;
  put(
    path: string,
    opOrHandler: OperationObject | RequestHandler,
    ...rest: RequestHandler[]
  ): this {
    if (isOperationObject(opOrHandler)) {
      this._builder.put(path, opOrHandler);
      this._app.put(path, ...rest);
    } else {
      this._app.put(path, opOrHandler, ...rest);
    }
    return this;
  }

  patch(path: string, operation: OperationObject, ...handlers: RequestHandler[]): this;
  patch(path: string, ...handlers: RequestHandler[]): this;
  patch(
    path: string,
    opOrHandler: OperationObject | RequestHandler,
    ...rest: RequestHandler[]
  ): this {
    if (isOperationObject(opOrHandler)) {
      this._builder.patch(path, opOrHandler);
      this._app.patch(path, ...rest);
    } else {
      this._app.patch(path, opOrHandler, ...rest);
    }
    return this;
  }

  delete(path: string, operation: OperationObject, ...handlers: RequestHandler[]): this;
  delete(path: string, ...handlers: RequestHandler[]): this;
  delete(
    path: string,
    opOrHandler: OperationObject | RequestHandler,
    ...rest: RequestHandler[]
  ): this {
    if (isOperationObject(opOrHandler)) {
      this._builder.delete(path, opOrHandler);
      this._app.delete(path, ...rest);
    } else {
      this._app.delete(path, opOrHandler, ...rest);
    }
    return this;
  }

  // ── Mount ─────────────────────────────────────────────────────────────

  /**
   * Register the catalog UI and spec routes. Call this after all routes are
   * registered so the spec snapshot is complete.
   *
   *   GET <basePath>                → catalog HTML
   *   GET <basePath>/<scopeId>.json → OpenAPI spec
   */
  mount(): this {
    const { _basePath, _scopeId, _title, _scopeLabel, _serverUrl } = this;
    const document = this._builder.build();

    const html = renderCatalogHtml({
      basePath: _basePath,
      title: _title,
      serverUrl: _serverUrl,
      scopes: [{ id: _scopeId, label: _scopeLabel, document }],
    });

    this._app.get(
      `${_basePath}/${_scopeId}.json`,
      (_req: Request, res: Response) => { res.json(document); },
    );

    this._app.get(_basePath, (_req: Request, res: Response) => {
      res.type("html").send(html);
    });

    return this;
  }
}
