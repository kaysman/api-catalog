/**
 * One selectable API scope in the catalog (e.g. "tenant", "platform").
 * Each scope is backed by a single OpenAPI document the catalog fetches
 * as JSON and renders.
 */
export interface CatalogScope {
  /** URL-safe id used in the spec route, e.g. "tenant" → /<basePath>/tenant.json */
  id: string;
  /** Label shown on the scope toggle button. */
  label: string;
  /**
   * The OpenAPI document for this scope. Either the object itself or a
   * getter (called once at mount time). Keeping it lazy lets the host
   * build the doc on first use.
   */
  document: unknown | (() => unknown);
}

export interface ApiCatalogOptions {
  /**
   * Base path the catalog is served under. The HTML page lives here and
   * each scope's spec at `<basePath>/<scopeId>.json`. Default "/api/docs".
   */
  basePath?: string;
  /** Page + sidebar title. Default "API Catalog". */
  title?: string;
  /**
   * Origin (or origin+prefix) the "Try it" console sends requests to —
   * e.g. "https://api.example.com" or "https://api.example.com/api/v1".
   * The host knows its own public URL (the same value it binds in
   * `app.listen`), so pass it here rather than relying on the spec's
   * `servers[0]`, which is often a build-time placeholder. A relative
   * value resolves against the page origin. Falls back to the spec
   * server, then the page's own origin.
   */
  serverUrl?: string;
  /** The selectable scopes. The first one is selected on load. */
  scopes: CatalogScope[];
}

/** Internal: a resolved scope with its document materialised. */
export interface ResolvedScope {
  id: string;
  label: string;
  document: unknown;
}
