// Type-checked as a *consumer* of the built package (resolved through
// node_modules/api-catalog → package.json exports / typesVersions), under each
// moduleResolution mode real projects use. See tsconfig.*.json alongside.
import { mountApiCatalog, renderCatalogHtml, type OpenApiDocument } from "api-catalog";
import { ExpressApiCatalog } from "api-catalog/express";
import { ApiCatalogAdapter, ApiOperation, ApiParam, ApiResponse } from "api-catalog/nestjs";
import { SpecBuilder, s, toOpenApiPath } from "api-catalog/spec";

const doc: OpenApiDocument = new SpecBuilder().title("t").get(toOpenApiPath("/a/:id"), { responses: {} }).build();
const schema = s.object({ id: s.string() }, ["id"]);

export const used = [
  mountApiCatalog, renderCatalogHtml, ExpressApiCatalog, ApiCatalogAdapter,
  ApiOperation, ApiParam, ApiResponse, doc, schema,
];
