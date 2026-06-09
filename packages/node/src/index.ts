/**
 * api-catalog — universal, framework-agnostic OpenAPI catalog.
 *
 * Renders a Postman/Bruno-style docs + try-it console from one or more
 * OpenAPI documents. Developers write their routes once, docs come with
 * them — inspired by GoSwagger.
 *
 * Framework subpaths:
 *   import { ExpressApiCatalog }  from "api-catalog/express"
 *   import { ApiCatalogAdapter }  from "api-catalog/nestjs"
 *   import { ApiOperation, ... }  from "api-catalog/nestjs"
 *
 * Spec builder:
 *   import { SpecBuilder, s }     from "api-catalog/spec"
 */
export { renderCatalogHtml } from "./render.js";
export { mountApiCatalog } from "./express.js";
export type { ApiCatalogOptions, CatalogScope } from "./types.js";

// Spec types — available from the root export for convenience
export type {
  OpenApiDocument,
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
  ReferenceObject,
  HttpMethod,
} from "./spec/openapi.js";
