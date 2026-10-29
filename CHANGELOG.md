# Changelog

All notable changes to this project are documented here. The npm package and
the Rust crate share version numbers.

## [0.1.0] - 2026-10-29

First public release.

### Added
- Interactive API console: endpoint tree, tabbed request editor (params, auth,
  headers, JSON body), response viewer, global bearer token and `{{variables}}`.
- **npm (`api-catalog`)**
  - `ExpressApiCatalog`: document and register Express routes in one call.
  - NestJS decorators (`@ApiOperation`, `@ApiQuery`, `@ApiParam`, `@ApiHeader`,
    `@ApiBody`, `@ApiResponse`) and `ApiCatalogAdapter.setup()`.
  - NestJS adapter options: `securitySchemes`, `security`, `globalPrefix`
    (read from `app.setGlobalPrefix()` automatically), and `enabled`. Docs are
    off in production unless `ENABLE_API_DOCS=true`.
  - Array controller and route paths in NestJS (`@Controller(["a", "b"])`).
  - `SpecBuilder`, `s` schema helpers, and `toOpenApiPath`.
  - Ships as CommonJS with type declarations, so it works from both CJS and
    ESM projects on Node 20+.
- **Rust (`api-catalog`)**
  - `Catalog` builder with the `route!` macro.
  - `axum` feature: `into_axum_router()`. `actix` feature: `configure()`.
  - `Catalog::openapi()` and `Catalog::html()` for any other framework.
- Examples for NestJS and Axum. CI on Node 20/22/24 and stable Rust.

### Fixed
- Framework path params (`:id`, `*rest`, `{id:\d+}`) are emitted as OpenAPI
  templates (`{id}`), so the generated documents validate.
- Axum: `GET <docs>/default.json` returned 404.
- The console derives its base path from its own URL when the server doesn't
  pass one, so a Rust catalog nested at any path loads its spec.
- `</script>` in a title or server URL can no longer break out of the page's
  inline config.

### Changed
- The Express default `basePath` is now `/docs` (was `/api/docs`), matching
  NestJS and Rust.
