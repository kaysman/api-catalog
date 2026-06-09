import { STYLES } from "./ui/styles.js";
import { CLIENT_SCRIPT } from "./ui/client.js";
import type { ApiCatalogOptions } from "./types.js";

const GEAR_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 13.4H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 7.6l.33-1.82a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10.6 3H12a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 19.4 4.6l1.82-.33"/></svg>';

const SEARCH_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>';

function escAttr(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

/**
 * Render the full standalone catalog HTML document for the given options.
 * Stateless and synchronous — call once and serve the string.
 */
export function renderCatalogHtml(opts: ApiCatalogOptions): string {
  const basePath = opts.basePath || "/api/docs";
  const title = opts.title || "API Catalog";
  const scopes = opts.scopes || [];

  const scopeButtons = scopes
    .map(
      (s, i) =>
        `<button data-scope="${escAttr(s.id)}"${i === 0 ? ' class="active"' : ""}>${escAttr(s.label)}</button>`,
    )
    .join("");

  // Config the client reads at boot. Only id/label leak to the browser.
  const clientConfig = JSON.stringify({
    basePath,
    serverUrl: opts.serverUrl || null,
    scopes: scopes.map((s) => ({ id: s.id, label: s.label })),
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escAttr(title)}</title>
<style>${STYLES}</style>
</head>
<body>
  <aside class="rail">
    <div class="rail-top">
      <div class="rail-title">${escAttr(title)}</div>
      <button class="rail-gear" id="gear" title="Global settings — variables & auth" aria-label="Global settings">${GEAR_ICON}</button>
    </div>
    <div class="search">
      ${SEARCH_ICON}
      <input id="search" type="text" placeholder="Search endpoints" autocomplete="off" />
    </div>
    <div class="scope">${scopeButtons}</div>
    <nav class="tree">
      <div class="tree-label">Modules</div>
      <div id="tree-items"></div>
    </nav>
  </aside>

  <main class="main">
    <div class="tabbar" id="tabbar"></div>
    <div class="panes" id="panes">
      <div class="empty" id="empty"><div><span class="spin"></span> Loading API specification…</div></div>
    </div>
  </main>

  <!-- Global settings modal -->
  <div class="modal-mask" id="globals-mask">
    <div class="modal">
      <div class="modal-head">
        <h2>Global settings</h2>
        <span class="mclose" title="Close">&times;</span>
      </div>
      <div class="modal-body">
        <div class="sub">Global auth</div>
        <label class="field-label">Bearer token</label>
        <input class="line gauth-token" placeholder="paste an access token — applied to requests that inherit auth">
        <div class="help">Requests default to <b>Inherit from globals</b> and send this as <code>Authorization: Bearer …</code>. Override or disable per request in each endpoint's Auth tab.</div>

        <div class="sub" style="margin-top:22px">Variables</div>
        <div class="kv gvars"></div>
        <button class="kv-add gvar-add">+ Add variable</button>
        <div class="help">Reference anywhere in a request — URL, params, headers, or body — as <code>{{name}}</code>. Substituted at send time.</div>
      </div>
      <div class="modal-foot">
        <button class="btn ghost g-cancel">Cancel</button>
        <button class="btn primary g-save">Save</button>
      </div>
    </div>
  </div>

<script>window.__API_CATALOG__ = ${clientConfig};</script>
<script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}
