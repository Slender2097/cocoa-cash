/*
 * cocoa.cash tip button: drop this on any page.
 *
 *   <script src="https://cocoa.cash/tip.js"
 *           data-mint="https://mint.example.com"
 *           data-amount="21"            (or "any")
 *           data-npub="npub1..."></script>
 *
 * Optional: data-label="Donate", data-relays="wss://a,wss://b", data-width="360".
 * It only inserts an iframe pointing at cocoa.cash/tip. Payments are NUT-18
 * payloads delivered to the creator's npub; nothing is held by cocoa.cash.
 */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var origin = new URL(s.src, location.href).origin;
  var params = new URLSearchParams();
  ["mint", "amount", "npub", "relays", "label"].forEach(function (k) {
    var v = s.getAttribute("data-" + k);
    if (v) params.set(k, v);
  });
  var f = document.createElement("iframe");
  f.src = origin + "/tip?" + params.toString();
  f.title = "Cashu tip";
  f.loading = "lazy";
  f.allow = "clipboard-write; camera";
  f.style.cssText = "border:0;width:" + (s.getAttribute("data-width") || "360") + "px;max-width:100%;height:420px;background:transparent;color-scheme:normal";
  f.setAttribute("allowtransparency", "true");
  s.parentNode.insertBefore(f, s.nextSibling);
  window.addEventListener("message", function (e) {
    if (e.origin !== origin || e.source !== f.contentWindow) return;
    var d = e.data;
    if (d && d.type === "cocoa-tip:height" && d.height > 0) f.style.height = Math.min(d.height, 900) + "px";
  });
})();
