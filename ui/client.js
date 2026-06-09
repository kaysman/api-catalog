
(function () {
  "use strict";

  var CFG = window.__API_CATALOG__ || { basePath: "/api/docs", scopes: [] };
  var BASE = CFG.basePath || "/api/docs";

  var scope = (CFG.scopes[0] && CFG.scopes[0].id) || "default";
  var spec = null;
  var groups = [];
  var endpointByKey = {};
  var openTabs = [];
  var activeKey = null;

  // ── Global settings (variables + auth), persisted per-scope ──
  function globalsKey() { return "apicat_globals_" + scope; }
  var globals = { variables: [], auth: { type: "bearer", token: "" } };
  function loadGlobals() {
    try {
      var raw = localStorage.getItem(globalsKey());
      if (raw) {
        var g = JSON.parse(raw);
        globals = {
          variables: Array.isArray(g.variables) ? g.variables : [],
          auth: g.auth && typeof g.auth === "object" ? { type: g.auth.type || "bearer", token: g.auth.token || "" } : { type: "bearer", token: "" },
        };
      } else {
        globals = { variables: [], auth: { type: "bearer", token: "" } };
      }
    } catch (e) { globals = { variables: [], auth: { type: "bearer", token: "" } }; }
  }
  function saveGlobals() { try { localStorage.setItem(globalsKey(), JSON.stringify(globals)); } catch (e) {} }
  function hasGlobals() { return !!(globals.auth.token || (globals.variables || []).some(function (v) { return v.on && v.key; })); }
  function varMap() {
    var m = {};
    (globals.variables || []).forEach(function (v) { if (v.on && v.key) m[v.key] = v.val; });
    return m;
  }
  // Replace {{name}} tokens with their global variable values.
  function interpolate(str) {
    var m = varMap();
    return String(str == null ? "" : str).replace(/\\{\\{\\s*([\\w.-]+)\\s*\\}\\}/g, function (whole, name) {
      return Object.prototype.hasOwnProperty.call(m, name) ? m[name] : whole;
    });
  }

  var els = {
    tree: document.getElementById("tree-items"),
    tabbar: document.getElementById("tabbar"),
    panes: document.getElementById("panes"),
    search: document.getElementById("search"),
    gear: document.getElementById("gear"),
    modalMask: document.getElementById("globals-mask"),
  };

  // ── Icons keyed by fuzzy tag match ──
  var ICON = {
    auth: '<path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Z"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>',
    company: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 13.4H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 7.6l.33-1.82a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10.6 3H12a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 19.4 4.6l1.82-.33"/>',
    client: '<path d="M16 7a4 4 0 1 0-8 0"/><path d="M3 21v-1a6 6 0 0 1 12 0v1"/><path d="M16 11a4 4 0 0 1 5 4v1"/>',
    carrier: '<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    fleet: '<path d="M14 16H9m10 0h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 16V5H2v11h3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    quote: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/>',
    order: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    cargo: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M14 10h2M8 14h2M14 14h2M8 18h2M14 18h2"/>',
    finance: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    reference: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    role: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
    health: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    device: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
    'default': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  };
  function iconFor(tag) {
    var t = tag.toLowerCase(), keys = Object.keys(ICON);
    for (var i = 0; i < keys.length; i++) if (keys[i] !== "default" && t.indexOf(keys[i]) !== -1) return ICON[keys[i]];
    if (t.indexOf("compan") !== -1) return ICON.company;
    if (t.indexOf("vehicle") !== -1 || t.indexOf("driver") !== -1) return ICON.fleet;
    if (t.indexOf("currenc") !== -1 || t.indexOf("vat") !== -1 || t.indexOf("rate") !== -1) return ICON.finance;
    if (t.indexOf("session") !== -1) return ICON.device;
    return ICON["default"];
  }
  function svg(inner, cls) { return '<svg class="' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'; }
  function slug(s) { return s.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase(); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  // Base the "Try it" requests resolve against, in priority order:
  //   1. serverUrl passed by the host into the catalog config (explicit).
  //   2. the spec's first server URL (often a build-time placeholder).
  //   3. the page's own origin (the catalog is served same-origin).
  // A relative value ("/" or "/api/v1") is resolved against the origin.
  function serverBase() {
    var declared = CFG.serverUrl
      || (spec && spec.servers && spec.servers[0] && spec.servers[0].url)
      || window.location.origin;
    try {
      return new URL(declared, window.location.origin).href.replace(/\\/$/, "");
    } catch (e) {
      return String(declared).replace(/\\/$/, "");
    }
  }

  // ── Build grouped model ──
  function buildGroups() {
    var tagMeta = {};
    (spec.tags || []).forEach(function (t) { tagMeta[t.name] = t.description || ""; });
    var byTag = {}, order = [], paths = spec.paths || {};
    endpointByKey = {};
    Object.keys(paths).forEach(function (p) {
      var item = paths[p];
      ["get", "post", "put", "patch", "delete"].forEach(function (m) {
        var op = item[m]; if (!op) return;
        var key = m + ":" + p;
        var ep = { path: p, method: m, op: op, key: key };
        endpointByKey[key] = ep;
        var tags = (op.tags && op.tags.length) ? op.tags : ["Other"];
        tags.forEach(function (tag) { if (!byTag[tag]) { byTag[tag] = []; order.push(tag); } byTag[tag].push(ep); });
      });
    });
    var declared = (spec.tags || []).map(function (t) { return t.name; }).filter(function (n) { return byTag[n]; });
    var extras = order.filter(function (n) { return declared.indexOf(n) === -1; });
    return declared.concat(extras).map(function (tag) { return { tag: tag, description: tagMeta[tag] || "", endpoints: byTag[tag] }; });
  }

  // ── Sidebar tree ──
  function renderTree() {
    els.tree.innerHTML = groups.map(function (g, gi) {
      var eps = g.endpoints.map(function (ep) {
        return '<button class="ep" data-key="' + esc(ep.key) + '" data-search="' + esc((ep.method + " " + ep.path + " " + (ep.op.summary || "")).toLowerCase()) + '">'
          + '<span class="verb v-' + ep.method + '">' + ep.method + '</span>'
          + '<span class="ep-path">' + esc(ep.op.summary || ep.path) + '</span>'
          + '</button>';
      }).join("");
      return '<div class="mod' + (gi === 0 ? " open" : "") + '" data-tag="' + slug(g.tag) + '" data-name="' + esc(g.tag.toLowerCase()) + '">'
        + '<button class="mod-head">'
        + svg('<path d="m9 18 6-6-6-6"/>', "caret")
        + svg(iconFor(g.tag), "mod-icon")
        + '<span class="mod-label">' + esc(g.tag) + '</span>'
        + '<span class="count">' + g.endpoints.length + '</span>'
        + '<span class="spacer"></span>'
        + '</button>'
        + '<div class="mod-list">' + eps + '</div>'
        + '</div>';
    }).join("");

    Array.prototype.forEach.call(els.tree.querySelectorAll(".mod-head"), function (head) {
      head.addEventListener("click", function () { head.parentElement.classList.toggle("open"); });
    });
    Array.prototype.forEach.call(els.tree.querySelectorAll(".ep"), function (btn) {
      btn.addEventListener("click", function () { openEndpoint(btn.getAttribute("data-key")); });
    });
  }

  function markActiveInTree() {
    Array.prototype.forEach.call(els.tree.querySelectorAll(".ep"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-key") === activeKey);
    });
  }

  // ── Tabs ──
  function openEndpoint(key) {
    if (openTabs.indexOf(key) === -1) {
      openTabs.push(key);
      els.panes.appendChild(buildPane(endpointByKey[key]));
    }
    activeKey = key;
    var btn = els.tree.querySelector('.ep[data-key="' + cssEscape(key) + '"]');
    if (btn) { var mod = btn.closest(".mod"); if (mod) mod.classList.add("open"); }
    renderTabs();
    syncPanes();
    markActiveInTree();
  }
  function closeTab(key, e) {
    if (e) e.stopPropagation();
    var i = openTabs.indexOf(key); if (i === -1) return;
    openTabs.splice(i, 1);
    var pane = els.panes.querySelector('.pane[data-key="' + cssEscape(key) + '"]');
    if (pane) pane.remove();
    if (activeKey === key) activeKey = openTabs[Math.min(i, openTabs.length - 1)] || null;
    renderTabs(); syncPanes(); markActiveInTree();
  }
  function cssEscape(s) { return s.replace(/["\\\\]/g, "\\\\$&"); }

  function renderTabs() {
    els.tabbar.innerHTML = openTabs.map(function (key) {
      var ep = endpointByKey[key];
      return '<div class="tab' + (key === activeKey ? " active" : "") + '" data-key="' + esc(key) + '">'
        + '<span class="tverb v-' + ep.method + '" style="background:transparent;padding:0">' + ep.method.toUpperCase() + '</span>'
        + '<span class="tlabel">' + esc(ep.path) + '</span>'
        + '<span class="tclose" data-close="' + esc(key) + '"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></span>'
        + '</div>';
    }).join("");
    Array.prototype.forEach.call(els.tabbar.querySelectorAll(".tab"), function (t) {
      t.addEventListener("click", function () { activeKey = t.getAttribute("data-key"); syncPanes(); renderTabs(); markActiveInTree(); });
    });
    Array.prototype.forEach.call(els.tabbar.querySelectorAll(".tclose"), function (c) {
      c.addEventListener("click", function (e) { closeTab(c.getAttribute("data-close"), e); });
    });
  }

  function syncPanes() {
    var empty = document.getElementById("empty");
    Array.prototype.forEach.call(els.panes.querySelectorAll(".pane"), function (p) {
      p.classList.toggle("active", p.getAttribute("data-key") === activeKey);
    });
    if (empty) empty.style.display = activeKey ? "none" : "grid";
  }

  // ── Schema → mock body ──
  function mockFromSchema(schema, depth) {
    if (!schema || depth > 4) return null;
    if (schema.example !== undefined) return schema.example;
    if (schema.enum) return schema.enum[0];
    var t = schema.type;
    if (t === "object" || schema.properties) {
      var out = {}, props = schema.properties || {};
      Object.keys(props).forEach(function (k) { out[k] = mockFromSchema(props[k], depth + 1); });
      return out;
    }
    if (t === "array") return [mockFromSchema(schema.items || {}, depth + 1)].filter(function (x) { return x !== null; });
    if (t === "integer" || t === "number") return 0;
    if (t === "boolean") return false;
    if (schema.format === "date-time") return new Date().toISOString();
    if (schema.format === "uuid") return "00000000-0000-0000-0000-000000000000";
    return "";
  }

  function kvRow(key, val, opts) {
    opts = opts || {};
    return '<div class="kv-row">'
      + '<input type="checkbox" class="kv-on" ' + (opts.off ? "" : "checked") + ' title="include">'
      + '<input class="k" placeholder="key" value="' + esc(key || "") + '"' + (opts.lockKey ? " disabled" : "") + '>'
      + '<input class="v" placeholder="value" value="' + esc(val == null ? "" : val) + '">'
      + '<span class="kv-del" title="remove">&times;</span>'
      + '</div>';
  }

  function paramTab(op) {
    var ps = (op.parameters || []).filter(function (p) { return p["in"] === "query" || p["in"] === "path"; });
    var rows = ps.map(function (p) {
      var s = p.schema || {};
      var sample = s.default != null ? s.default : (s.enum ? s.enum[0] : (p["in"] === "path" ? ":" + p.name : ""));
      return kvRow(p.name, sample, { lockKey: true, off: !p.required && p["in"] === "query" });
    }).join("");
    return '<div class="kv kv-params">' + rows + '</div>'
      + '<button class="kv-add" data-add="params">+ Add parameter</button>'
      + (ps.length ? "" : '<div class="req-empty" style="margin-top:4px">No declared parameters. Add your own above.</div>');
  }

  // Headers tab: only extra (non-auth) headers. Auth lives in its own tab.
  function headerTab() {
    return '<div class="kv kv-headers">'
      + kvRow("Accept", "application/json", {})
      + kvRow("X-Language", "ru", {})
      + '</div>'
      + '<button class="kv-add" data-add="headers">+ Add header</button>';
  }

  // Auth tab: inherit-from-global (default) / none / override.
  // The radio group name must be unique per pane — radio grouping is
  // global by the name attribute, so a shared name lets a selection in
  // one open tab uncheck the others, and resolveAuth (pane-scoped) then
  // finds nothing checked and drops the Authorization header.
  function authTab(key) {
    var group = "authmode-" + slug(key);
    var token = globals.auth.token;
    var inheritedNote = token
      ? 'Inherits the global bearer token set in Settings.'
      : 'No global auth set yet. Open Settings (gear, top-left) to add a token, or override below.';
    return '<div class="auth-mode">'
      + '<label class="auth-opt"><input type="radio" class="authmode" name="' + group + '" value="inherit" checked>'
      + '<span>Inherit from globals<span class="hint auth-inherited-note">' + esc(inheritedNote) + '</span></span></label>'
      + '<label class="auth-opt"><input type="radio" class="authmode" name="' + group + '" value="none">'
      + '<span>No auth<span class="hint">Send without an Authorization header.</span></span></label>'
      + '<label class="auth-opt"><input type="radio" class="authmode" name="' + group + '" value="override">'
      + '<span>Override<span class="hint">Use a bearer token just for this request.</span></span></label>'
      + '</div>'
      + '<div class="auth-override"><label class="field-label">Bearer token</label>'
      + '<input class="line auth-token" placeholder="token for this request only" value=""></div>';
  }

  function bodyTab(op) {
    var json = op.requestBody && (op.requestBody.content || {})["application/json"];
    if (!json || !json.schema) return '<div class="body-none">This request has no body.</div>';
    var mock = JSON.stringify(mockFromSchema(json.schema, 0) || {}, null, 2);
    return '<div class="body-area"><textarea class="pg-body" spellcheck="false">' + esc(mock) + '</textarea></div>'
      + '<details class="docs" style="margin-top:10px"><summary>View body schema</summary>'
      + '<pre class="code" style="margin-top:8px">' + esc(JSON.stringify(json.schema, null, 2)) + '</pre></details>';
  }

  function docsTab(op) {
    var ps = op.parameters || [];
    return ps.length
      ? '<table class="params"><thead><tr><th>Name</th><th>In</th><th>Type</th><th>Description</th></tr></thead><tbody>'
        + ps.map(function (p) { var s = p.schema || {}; return '<tr><td class="name">' + esc(p.name) + (p.required ? '<span class="req">*</span>' : '') + '</td><td><span class="loc">' + esc(p["in"]) + '</span></td><td>' + esc(s.type || (s.$ref ? "ref" : "")) + '</td><td>' + esc(p.description || "") + '</td></tr>'; }).join("")
        + '</tbody></table>'
      : '<div class="req-empty">No parameters documented.</div>';
  }

  function buildPane(ep) {
    var hasBody = !!(ep.op.requestBody && ep.op.requestBody.content && ep.op.requestBody.content["application/json"]);
    var fullUrl = serverBase() + ep.path;

    var pane = document.createElement("div");
    pane.className = "pane";
    pane.setAttribute("data-key", ep.key);
    pane.setAttribute("data-method", ep.method);

    pane.innerHTML =
      (ep.op.summary ? '<div class="pane-summary" style="margin-top:0">' + esc(ep.op.summary) + '</div>' : '')
      + (ep.op.description ? '<div class="pane-desc">' + esc(ep.op.description) + '</div>' : '')
      + '<div class="urlbar">'
      + '<span class="verb v-' + ep.method + '">' + ep.method + '</span>'
      + '<input class="u-input pg-url" spellcheck="false" value="' + esc(fullUrl) + '">'
      + '<button class="btn primary pg-send">Send</button>'
      + '</div>'
      + '<div class="split">'
      + '<section class="col col-req">'
      + '<div class="col-title">Request</div>'
      + '<div class="req-tabs">'
      + '<button class="req-tab active" data-rt="params">Params</button>'
      + '<button class="req-tab" data-rt="auth">Auth</button>'
      + '<button class="req-tab" data-rt="headers">Headers</button>'
      + '<button class="req-tab" data-rt="body">Body' + (hasBody ? '<span class="badge">json</span>' : '') + '</button>'
      + '<button class="req-tab" data-rt="docs">Docs</button>'
      + '</div>'
      + '<div class="req-panel active" data-rp="params">' + paramTab(ep.op) + '</div>'
      + '<div class="req-panel" data-rp="auth">' + authTab(ep.key) + '</div>'
      + '<div class="req-panel" data-rp="headers">' + headerTab() + '</div>'
      + '<div class="req-panel" data-rp="body">' + bodyTab(ep.op) + '</div>'
      + '<div class="req-panel" data-rp="docs">' + docsTab(ep.op) + '</div>'
      + '</section>'
      + '<section class="col col-resp">'
      + '<div class="col-title">Response<span class="resp-meta"></span></div>'
      + '<div class="resp-placeholder">Send the request to see the response.</div>'
      + '<pre class="code resp-body" style="display:none"></pre>'
      + '</section>'
      + '</div>';

    wirePane(pane, ep);
    return pane;
  }

  function wirePane(pane, ep) {
    Array.prototype.forEach.call(pane.querySelectorAll(".req-tab"), function (t) {
      t.addEventListener("click", function () {
        Array.prototype.forEach.call(pane.querySelectorAll(".req-tab"), function (x) { x.classList.remove("active"); });
        Array.prototype.forEach.call(pane.querySelectorAll(".req-panel"), function (x) { x.classList.remove("active"); });
        t.classList.add("active");
        pane.querySelector('.req-panel[data-rp="' + t.getAttribute("data-rt") + '"]').classList.add("active");
      });
    });

    function wireKv(scope) {
      Array.prototype.forEach.call(pane.querySelectorAll(scope + " .kv-del"), function (d) {
        d.addEventListener("click", function () { d.closest(".kv-row").remove(); });
      });
    }
    wireKv(".kv-params"); wireKv(".kv-headers");
    Array.prototype.forEach.call(pane.querySelectorAll(".kv-add"), function (add) {
      add.addEventListener("click", function () {
        var target = pane.querySelector(".kv-" + add.getAttribute("data-add"));
        var tmp = document.createElement("div"); tmp.innerHTML = kvRow("", "", {});
        var row = tmp.firstChild;
        row.querySelector(".kv-del").addEventListener("click", function () { row.remove(); });
        target.appendChild(row);
      });
    });

    // Auth mode radios → toggle the override field.
    var override = pane.querySelector(".auth-override");
    Array.prototype.forEach.call(pane.querySelectorAll(".authmode"), function (r) {
      r.addEventListener("change", function () { override.classList.toggle("show", r.value === "override" && r.checked); });
    });

    pane.querySelector(".pg-send").addEventListener("click", function () { sendRequest(pane, ep.method); });
    pane.querySelector(".pg-url").addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sendRequest(pane, ep.method);
    });
  }

  function collectKv(container) {
    var out = [];
    if (!container) return out;
    Array.prototype.forEach.call(container.querySelectorAll(".kv-row"), function (row) {
      var on = row.querySelector(".kv-on").checked;
      var k = row.querySelector(".k").value.trim();
      var v = row.querySelector(".v").value;
      if (on && k) out.push([k, v]);
    });
    return out;
  }

  // Resolve the Authorization header from the pane's auth mode + globals.
  function resolveAuth(pane) {
    var mode = "inherit";
    var checked = pane.querySelector(".authmode:checked");
    if (checked) mode = checked.value;
    if (mode === "none") return null;
    if (mode === "override") {
      var t = (pane.querySelector(".auth-token").value || "").trim();
      return t ? "Bearer " + t : null;
    }
    // inherit
    return globals.auth.token ? "Bearer " + globals.auth.token : null;
  }

  function sendRequest(pane, method) {
    var btn = pane.querySelector(".pg-send");
    var meta = pane.querySelector(".resp-meta");
    var out = pane.querySelector(".resp-body");
    var placeholder = pane.querySelector(".resp-placeholder");
    var bodyEl = pane.querySelector(".pg-body");
    var rawUrl = interpolate(pane.querySelector(".pg-url").value.trim());

    var params = collectKv(pane.querySelector(".kv-params"));
    var query = [];
    params.forEach(function (kv) {
      var val = interpolate(kv[1]);
      var token = ":" + kv[0];
      if (rawUrl.indexOf(token) !== -1) rawUrl = rawUrl.replace(token, encodeURIComponent(val));
      else if (val !== "") query.push(encodeURIComponent(kv[0]) + "=" + encodeURIComponent(val));
    });
    if (query.length) rawUrl += (rawUrl.indexOf("?") === -1 ? "?" : "&") + query.join("&");

    var headers = {};
    collectKv(pane.querySelector(".kv-headers")).forEach(function (kv) { headers[kv[0]] = interpolate(kv[1]); });
    var auth = resolveAuth(pane);
    if (auth) headers["Authorization"] = interpolate(auth);

    var init = { method: method.toUpperCase(), headers: headers };
    if (bodyEl && bodyEl.value.trim()) {
      if (!Object.keys(headers).some(function (h) { return h.toLowerCase() === "content-type"; })) headers["Content-Type"] = "application/json";
      init.body = interpolate(bodyEl.value);
    }

    btn.disabled = true;
    meta.innerHTML = '<span class="spin"></span>';
    placeholder.style.display = "none";
    var t0 = performance.now();
    fetch(rawUrl, init).then(function (res) {
      var ms = Math.round(performance.now() - t0);
      meta.innerHTML = '<span class="resp-status ' + (res.ok ? "resp-ok" : "resp-err") + '">' + res.status + ' ' + esc(res.statusText || "") + '</span> · ' + ms + 'ms';
      return res.text().then(function (text) {
        var pretty = text; try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch (e) {}
        out.style.display = "block"; out.textContent = pretty || "(empty response)";
      });
    }).catch(function (err) {
      meta.innerHTML = '<span class="resp-status resp-err">network error</span>';
      out.style.display = "block"; out.textContent = String(err);
    }).then(function () { btn.disabled = false; });
  }

  // ── Global settings modal ──
  function gVarRow(v) {
    v = v || { key: "", val: "", on: true };
    return '<div class="kv-row gvar">'
      + '<input type="checkbox" class="kv-on" ' + (v.on === false ? "" : "checked") + '>'
      + '<input class="k" placeholder="name (use as {{name}})" value="' + esc(v.key) + '">'
      + '<input class="v" placeholder="value" value="' + esc(v.val) + '">'
      + '<span class="kv-del" title="remove">&times;</span>'
      + '</div>';
  }
  function openGlobals() {
    var vars = (globals.variables && globals.variables.length) ? globals.variables : [{ key: "", val: "", on: true }];
    els.modalMask.querySelector(".gvars").innerHTML = vars.map(gVarRow).join("");
    els.modalMask.querySelector(".gauth-token").value = globals.auth.token || "";
    wireGvarRows();
    els.modalMask.classList.add("show");
  }
  function closeGlobals() { els.modalMask.classList.remove("show"); }
  function wireGvarRows() {
    Array.prototype.forEach.call(els.modalMask.querySelectorAll(".gvars .kv-del"), function (d) {
      d.addEventListener("click", function () { d.closest(".kv-row").remove(); });
    });
  }
  function saveGlobalsFromModal() {
    var vars = [];
    Array.prototype.forEach.call(els.modalMask.querySelectorAll(".gvars .kv-row"), function (row) {
      var key = row.querySelector(".k").value.trim();
      if (!key) return;
      vars.push({ key: key, val: row.querySelector(".v").value, on: row.querySelector(".kv-on").checked });
    });
    globals.variables = vars;
    globals.auth.token = (els.modalMask.querySelector(".gauth-token").value || "").trim();
    saveGlobals();
    els.gear.classList.toggle("has-globals", hasGlobals());
    closeGlobals();
  }
  function wireGlobalsModal() {
    els.gear.addEventListener("click", openGlobals);
    els.modalMask.querySelector(".mclose").addEventListener("click", closeGlobals);
    els.modalMask.querySelector(".g-cancel").addEventListener("click", closeGlobals);
    els.modalMask.querySelector(".g-save").addEventListener("click", saveGlobalsFromModal);
    els.modalMask.querySelector(".gvar-add").addEventListener("click", function () {
      var tmp = document.createElement("div"); tmp.innerHTML = gVarRow();
      var row = tmp.firstChild;
      row.querySelector(".kv-del").addEventListener("click", function () { row.remove(); });
      els.modalMask.querySelector(".gvars").appendChild(row);
    });
    els.modalMask.addEventListener("click", function (e) { if (e.target === els.modalMask) closeGlobals(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeGlobals(); });
  }

  // ── Search ──
  function applySearch() {
    var q = els.search.value.trim().toLowerCase();
    Array.prototype.forEach.call(els.tree.querySelectorAll(".mod"), function (mod) {
      var visible = 0;
      Array.prototype.forEach.call(mod.querySelectorAll(".ep"), function (ep) {
        var match = !q || ep.getAttribute("data-search").indexOf(q) !== -1 || mod.getAttribute("data-name").indexOf(q) !== -1;
        ep.classList.toggle("hidden", !match);
        if (match) visible++;
      });
      mod.classList.toggle("hidden", q && visible === 0);
      if (q && visible > 0) mod.classList.add("open");
    });
  }
  els.search.addEventListener("input", applySearch);

  // ── Scope toggle ──
  Array.prototype.forEach.call(document.querySelectorAll(".scope button"), function (b) {
    b.addEventListener("click", function () {
      if (b.getAttribute("data-scope") === scope) return;
      document.querySelectorAll(".scope button").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      scope = b.getAttribute("data-scope");
      els.search.value = "";
      loadGlobals();
      els.gear.classList.toggle("has-globals", hasGlobals());
      load();
    });
  });

  // ── Load ──
  function load() {
    openTabs = []; activeKey = null;
    els.tree.innerHTML = "";
    els.tabbar.innerHTML = "";
    Array.prototype.forEach.call(els.panes.querySelectorAll(".pane"), function (p) { p.remove(); });
    var empty = document.getElementById("empty");
    empty.style.display = "grid";
    empty.innerHTML = '<div><span class="spin"></span> Loading ' + scope + ' specification…</div>';

    fetch(BASE + "/" + scope + ".json").then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status); return r.json();
    }).then(function (json) {
      spec = json;
      groups = buildGroups();
      renderTree();
      empty.innerHTML = '<div>Select an endpoint from the left to open it in a tab.<br><span style="font-size:12px">Tip: click a module to expand its endpoints.</span></div>';
      empty.style.display = "grid";
      var first = groups[0] && groups[0].endpoints[0];
      if (first) openEndpoint(first.key);
    }).catch(function (err) {
      empty.innerHTML = '<div>Failed to load spec: ' + esc(String(err)) + '</div>';
    });
  }

  // ── Boot ──
  loadGlobals();
  els.gear.classList.toggle("has-globals", hasGlobals());
  wireGlobalsModal();
  load();
})();
