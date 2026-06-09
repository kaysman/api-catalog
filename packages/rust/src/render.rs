use crate::spec::CatalogOptions;

// ui/ at the repo root is the single source of truth for the catalog frontend.
// Both this Rust crate and the npm package read from it.
// To update: edit ui/styles.css or ui/client.js, then run:
//   node scripts/build-ui.mjs   (regenerates the npm package's TS wrappers)
// The Rust crate reads the raw files directly at compile time.
const STYLES: &str = include_str!("../../../ui/styles.css");
const CLIENT_SCRIPT: &str = include_str!("../../../ui/client.js");

fn esc_attr(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('"', "&quot;")
}

/// Render the full standalone catalog HTML document. Stateless and
/// synchronous — call once at startup and cache the result.
pub fn render_catalog_html(opts: &CatalogOptions) -> String {
    let title = &opts.title;
    let server_url_js = opts
        .server_url
        .as_deref()
        .map(|u| format!("\"{}\"", u.replace('"', "\\\"")))
        .unwrap_or_else(|| "null".to_string());

    let scope_buttons: String = opts
        .scopes
        .iter()
        .enumerate()
        .map(|(i, s)| {
            format!(
                "<button data-scope=\"{}\"{}>{}</button>",
                esc_attr(&s.id),
                if i == 0 { " class=\"active\"" } else { "" },
                esc_attr(&s.label),
            )
        })
        .collect();

    let client_config = {
        let scopes_json: String = opts
            .scopes
            .iter()
            .map(|s| {
                format!(
                    "{{\"id\":\"{}\",\"label\":\"{}\"}}",
                    s.id.replace('"', "\\\""),
                    s.label.replace('"', "\\\""),
                )
            })
            .collect::<Vec<_>>()
            .join(",");
        format!(
            "{{\"basePath\":\"/docs\",\"serverUrl\":{},\"scopes\":[{}]}}",
            server_url_js, scopes_json
        )
    };

    let gear_icon = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 13.4H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 7.6l.33-1.82a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10.6 3H12a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 19.4 4.6l1.82-.33"/></svg>"#;
    let search_icon = r#"<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>"#;

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title}</title>
<style>{styles}</style>
</head>
<body>
  <aside class="rail">
    <div class="rail-top">
      <div class="rail-title">{title}</div>
      <button class="rail-gear" id="gear" title="Global settings" aria-label="Global settings">{gear_icon}</button>
    </div>
    <div class="search">
      {search_icon}
      <input id="search" type="text" placeholder="Search endpoints" autocomplete="off" />
    </div>
    <div class="scope">{scope_buttons}</div>
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

  <div class="modal-mask" id="globals-mask">
    <div class="modal">
      <div class="modal-head">
        <h2>Global settings</h2>
        <span class="mclose" title="Close">&times;</span>
      </div>
      <div class="modal-body">
        <div class="sub">Global auth</div>
        <label class="field-label">Bearer token</label>
        <input class="line gauth-token" placeholder="paste an access token">
        <div class="help">Requests default to <b>Inherit from globals</b> and send this as <code>Authorization: Bearer …</code>.</div>
        <div class="sub" style="margin-top:22px">Variables</div>
        <div class="kv gvars"></div>
        <button class="kv-add gvar-add">+ Add variable</button>
        <div class="help">Reference as <code>{{{{name}}}}</code> in URLs, params, headers, or body.</div>
      </div>
      <div class="modal-foot">
        <button class="btn ghost g-cancel">Cancel</button>
        <button class="btn primary g-save">Save</button>
      </div>
    </div>
  </div>

<script>window.__API_CATALOG__ = {client_config};</script>
<script>{client_script}</script>
</body>
</html>"#,
        title = esc_attr(title),
        styles = STYLES,
        gear_icon = gear_icon,
        search_icon = search_icon,
        scope_buttons = scope_buttons,
        client_config = client_config,
        client_script = CLIENT_SCRIPT,
    )
}
