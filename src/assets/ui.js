// Small helper that wires a calculator form to a render function.
// Recalculates on every input; no submit button needed.
(function () {
  "use strict";
  var money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
  var money0 = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
  var num = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });

  Calc.fmt = {
    money: function (x) { return isFinite(x) ? money.format(x) : "-"; },
    money0: function (x) { return isFinite(x) ? money0.format(x) : "-"; },
    num: function (x) { return isFinite(x) ? num.format(x) : "-"; },
    pct: function (x, d) { return isFinite(x) ? (x * 100).toFixed(d === undefined ? 1 : d) + "%" : "-"; }
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  // rows: [[label, value, isHeadline?], ...]
  Calc.table = function (rows) {
    return '<dl class="rows">' + rows.map(function (r) {
      return '<div class="row' + (r[2] ? " big" : "") + '"><dt>' + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>";
    }).join("") + "</dl>";
  };

  // Result box for the car stamp duty pages. extra: more [label, value] rows.
  Calc.dutyResult = function (state, value, opts, extra) {
    var r = Calc.carDuty(state, value || 0, opts);
    return Calc.table([
      ["Stamp duty", Calc.fmt.money(r.duty), true],
      ["Share of the car's value", Calc.fmt.pct(r.effectiveRate, 2)],
      ["Rate used", r.how]
    ].concat(extra || []));
  };

  Calc.ui = function (formId, render) {
    var form = document.getElementById(formId);
    var out = document.getElementById(formId + "-out");
    if (!form || !out) return;
    function values() {
      var v = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        if (el.type === "checkbox") v[el.name] = el.checked;
        else if (el.type === "radio") { if (el.checked) v[el.name] = el.value; }
        else if (el.type === "number") v[el.name] = el.value === "" ? NaN : parseFloat(el.value);
        else v[el.name] = el.value;
      });
      return v;
    }
    function update() {
      try { out.innerHTML = render(values(), form); }
      catch (e) { out.innerHTML = '<p class="note">Check the numbers above.</p>'; }
    }
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("submit", function (e) { e.preventDefault(); update(); });
    update();
  };
})();
