import type { Request, Response, RequestHandler } from "express";
import { renderCatalogHtml } from "./render.js";
import type { ApiCatalogOptions, ResolvedScope } from "./types.js";

// Re-export the code-first adapter from this subpath as well.
export { ExpressApiCatalog } from "./adapters/express.js";
export type { ExpressCatalogOptions } from "./adapters/express.js";

/**
 * The minimal route-registration surface shared by an Express `app` and
 * a `Router`. Typed directly (rather than `Pick<Express|Router,'get'>`)
 * so the settings-getter overload of `app.get` doesn't poison inference.
 */
interface Mountable {
  get(path: string, ...handlers: RequestHandler[]): unknown;
}

function resolveScopes(opts: ApiCatalogOptions): ResolvedScope[] {
  return opts.scopes.map((s) => ({
    id: s.id,
    label: s.label,
    document: typeof s.document === "function" ? (s.document as () => unknown)() : s.document,
  }));
}

/**
 * Mount the API catalog on an Express app (or router):
 *
 *   <basePath>                 → the catalog HTML page
 *   <basePath>/<scopeId>.json  → that scope's OpenAPI document
 *
 * The HTML is rendered once at mount; the JSON docs are resolved once too.
 *
 *   mountApiCatalog(app, {
 *     basePath: "/api/docs",
 *     title: "RR API Catalog",
 *     scopes: [
 *       { id: "tenant", label: "Tenant", document: getTenantDoc },
 *       { id: "platform", label: "Platform", document: getPlatformDoc },
 *     ],
 *   });
 */
export function mountApiCatalog(app: Mountable, opts: ApiCatalogOptions): void {
  const basePath = opts.basePath || "/api/docs";
  const scopes = resolveScopes(opts);
  const html = renderCatalogHtml({ ...opts, basePath });

  for (const scope of scopes) {
    app.get(`${basePath}/${scope.id}.json`, (_req: Request, res: Response) => {
      res.json(scope.document);
    });
  }

  app.get(basePath, (_req: Request, res: Response) => {
    res.type("html").send(html);
  });
}
