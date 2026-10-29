import { describe, expect, it } from "vitest";
import { renderCatalogHtml } from "../src/render.js";

const scope = { id: "default", label: "API", document: { openapi: "3.0.3", info: { title: "API", version: "1" }, paths: {} } };

describe("renderCatalogHtml", () => {
  it("renders a standalone page with the client config", () => {
    const html = renderCatalogHtml({ title: "Users API", basePath: "/docs", scopes: [scope] });
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("<title>Users API</title>");
    expect(html).toContain('"basePath":"/docs"');
  });

  it("escapes the title in markup", () => {
    const html = renderCatalogHtml({ title: '<img src=x onerror="alert(1)">', scopes: [scope] });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;>");
  });

  it("keeps </script> in config values from closing the inline script", () => {
    const html = renderCatalogHtml({
      title: "API",
      serverUrl: "https://x</script><script>alert(1)</script>",
      scopes: [scope],
    });
    expect(html).not.toContain("</script><script>alert(1)");
  });
});
