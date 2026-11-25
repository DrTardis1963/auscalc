// All calculator maths lives here as pure functions, so the pages and the
// test script (tests/check.js) use exactly the same code.
// Yearly refresh: update RATES below, then run `node tests/check.js`.
(function (root) {
  "use strict";

  var RATES = {
    incomeYear: "2026-27",
    checked: "21 November 2026",
    // ATO: Tax rates - Australian resident, 2026-27 (resident, full tax-free threshold)
    brackets: [
      { over: 0, base: 0, rate: 0 },
      { over: 18200, base: 0, rate: 0.15 },
      { over: 45000, base: 4020, rate: 0.30 },
      { over: 135000, base: 31020, rate: 0.37 },
      { over: 190000, base: 51370, rate: 0.45 }
    ],
    // ATO: Low income tax offset
    lito: { max: 700, full: 37500, mid: 45000, midAmount: 325, end: 66667, taper1: 0.05, taper2: 0.015 },
    // ATO: Medicare levy 2%; single low-income thresholds (latest published: 2025-26)
    medicare: { rate: 0.02, lower: 28011, upper: 35013, phaseIn: 0.10, thresholdYear: "2025-26" },
    // ATO: Super guarantee 12% from 1 July 2025
    superGuarantee: 0.12,
    gst: 0.10
  };

  function round2(x) { return Math.round(x * 100) / 100; }

  function incomeTax(taxable) {
    var b = RATES.brackets, t = 0;
    for (var i = b.length - 1; i >= 0; i--) {
      if (taxable > b[i].over) { t = b[i].base + (taxable - b[i].over) * b[i].rate; break; }
    }
    return round2(t);
  }

  function lito(taxable) {
    var L = RATES.lito;
    if (taxable <= L.full) return L.max;
    if (taxable <= L.mid) return round2(L.max - (taxable - L.full) * L.taper1);
    if (taxable <= L.end) return round2(Math.max(0, L.midAmount - (taxable - L.mid) * L.taper2));
    return 0;
  }

  function medicareLevy(taxable) {
    var M = RATES.medicare;
    if (taxable <= M.lower) return 0;
    var full = taxable * M.rate;
    if (taxable <= M.upper) return round2(Math.min(full, (taxable - M.lower) * M.phaseIn));
    return round2(full);
  }

  // Take-home pay for a resident claiming the tax-free threshold.
  function payAfterTax(annualSalary, opts) {
    opts = opts || {};
    var base = opts.includesSuper ? annualSalary / (1 + RATES.superGuarantee) : annualSalary;
    base = round2(base);
    var tax = incomeTax(base);
    var offset = Math.min(tax, lito(base));
    var incomeTaxNet = round2(tax - offset);
    var medicare = medicareLevy(base);
    var totalTax = round2(incomeTaxNet + medicare);
    var net = round2(base - totalTax);
    return {
      gross: base,
      incomeTax: tax,
      lito: offset,
      incomeTaxNet: incomeTaxNet,
      medicare: medicare,
      totalTax: totalTax,
      net: net,
      super: round2(base * RATES.superGuarantee),
      effectiveRate: base > 0 ? totalTax / base : 0,
      marginalRate: marginalRate(base)
    };
  }

  function marginalRate(taxable) {
    var b = RATES.brackets, r = 0;
    for (var i = 0; i < b.length; i++) if (taxable > b[i].over) r = b[i].rate;
    var M = RATES.medicare, L = RATES.lito;
    if (taxable > M.upper) r += M.rate;
    else if (taxable > M.lower) r += M.phaseIn;
    // The low income tax offset shrinking as income rises acts like extra tax.
    if (taxable > L.full && taxable <= L.mid) r += L.taper1;
    else if (taxable > L.mid && taxable <= L.end) r += L.taper2;
    return Math.round(r * 1000) / 1000;
  }

  function gst(amount, mode) {
    var g = RATES.gst;
    if (mode === "remove") {
      var ex = amount / (1 + g);
      return { exGst: round2(ex), gst: round2(amount - ex), incGst: round2(amount) };
    }
    return { exGst: round2(amount), gst: round2(amount * g), incGst: round2(amount * (1 + g)) };
  }

  // Principal-and-interest repayment for a given number of periods.
  function repayment(principal, annualRate, periodsPerYear, years) {
    var n = Math.round(years * periodsPerYear);
    var r = annualRate / periodsPerYear;
    if (n <= 0) return 0;
    if (r === 0) return principal / n;
    var f = Math.pow(1 + r, n);
    return principal * r * f / (f - 1);
  }

  // How many periods it takes to clear a loan paying `payment` each period.
  function periodsToRepay(principal, annualRate, periodsPerYear, payment) {
    var r = annualRate / periodsPerYear;
    if (r === 0) return principal / payment;
    var x = 1 - principal * r / payment;
    if (x <= 0) return Infinity;
    return -Math.log(x) / Math.log(1 + r);
  }

  function mortgage(principal, annualRate, years) {
    var monthly = repayment(principal, annualRate, 12, years);
    var fortnightly = repayment(principal, annualRate, 26, years);
    var weekly = repayment(principal, annualRate, 52, years);
    var totalMonthly = monthly * Math.round(years * 12);
    // "Half the monthly repayment, every fortnight" trick
    var halfMonthly = monthly / 2;
    var acceleratedPeriods = periodsToRepay(principal, annualRate, 26, halfMonthly);
    var acceleratedTotal = halfMonthly * acceleratedPeriods;
    return {
      monthly: round2(monthly),
      fortnightly: round2(fortnightly),
      weekly: round2(weekly),
      interestOnlyMonthly: round2(principal * annualRate / 12),
      totalPaid: round2(totalMonthly),
      totalInterest: round2(totalMonthly - principal),
      accelerated: {
        payment: round2(halfMonthly),
        years: acceleratedPeriods / 26,
        totalInterest: round2(acceleratedTotal - principal),
        interestSaved: round2(totalMonthly - acceleratedTotal)
      }
    };
  }

  function superGuarantee(annualSalary, includesSuper) {
    var sg = RATES.superGuarantee;
    var base = includesSuper ? annualSalary / (1 + sg) : annualSalary;
    var yearly = base * sg;
    return {
      base: round2(base),
      yearly: round2(yearly),
      monthly: round2(yearly / 12),
      fortnightly: round2(yearly / 26),
      weekly: round2(yearly / 52),
      packageTotal: round2(base + yearly)
    };
  }

  // Convert pay between periods. `period` is hour|week|fortnight|month|year.
  function salaryConvert(amount, period, hoursPerWeek) {
    var h = hoursPerWeek > 0 ? hoursPerWeek : 38;
    var perYear = { hour: h * 52, week: 52, fortnight: 26, month: 12, year: 1 }[period] || 1;
    var annual = amount * perYear;
    return {
      hourly: round2(annual / (h * 52)),
      weekly: round2(annual / 52),
      fortnightly: round2(annual / 26),
      monthly: round2(annual / 12),
      annual: round2(annual)
    };
  }

  function casualToPermanent(casualHourly, loading) {
    return round2(casualHourly / (1 + (loading === undefined ? 0.25 : loading)));
  }

  function fuelTrip(km, litresPer100, pricePerLitre, returnTrip, people) {
    var dist = km * (returnTrip ? 2 : 1);
    var litres = dist * litresPer100 / 100;
    var cost = litres * pricePerLitre;
    var p = people > 0 ? people : 1;
    return { distance: dist, litres: round2(litres), cost: round2(cost), perPerson: round2(cost / p) };
  }

  function applianceCost(watts, hoursPerDay, centsPerKwh) {
    var kwhDay = watts * hoursPerDay / 1000;
    var day = kwhDay * centsPerKwh / 100;
    return {
      kwhPerDay: round2(kwhDay),
      perHour: round2(watts / 1000 * centsPerKwh / 100),
      perDay: round2(day),
      perWeek: round2(day * 7),
      perQuarter: round2(day * 91.25),
      perYear: round2(day * 365)
    };
  }

  function evVsPetrol(kmPerYear, litresPer100, pricePerLitre, kwhPer100, centsPerKwh) {
    var petrol100 = litresPer100 * pricePerLitre;
    var ev100 = kwhPer100 * centsPerKwh / 100;
    var petrolYear = petrol100 * kmPerYear / 100;
    var evYear = ev100 * kmPerYear / 100;
    return {
      petrolPer100: round2(petrol100),
      evPer100: round2(ev100),
      petrolPerYear: round2(petrolYear),
      evPerYear: round2(evYear),
      savingPerYear: round2(petrolYear - evYear)
    };
  }

  // Typical average daily yield (kWh per kW of panels per day), north-facing, capital cities.
  var SOLAR_YIELD = {
    Adelaide: 4.2, Brisbane: 4.2, Canberra: 4.3, Darwin: 4.4,
    Hobart: 3.5, Melbourne: 3.6, Perth: 4.4, Sydney: 3.9
  };

  function solarPayback(kw, cost, dailyYield, selfUsePct, tariffCents, feedInCents) {
    var gen = kw * dailyYield * 365;
    var self = gen * selfUsePct / 100;
    var exported = gen - self;
    var saveSelf = self * tariffCents / 100;
    var saveExport = exported * feedInCents / 100;
    var total = saveSelf + saveExport;
    return {
      generation: Math.round(gen),
      selfUsed: Math.round(self),
      exported: Math.round(exported),
      savingSelf: round2(saveSelf),
      savingExport: round2(saveExport),
      savingPerYear: round2(total),
      paybackYears: total > 0 ? cost / total : Infinity
    };
  }

  // Monthly compounding, deposit at the end of each month.
  function compoundSavings(start, monthly, annualRate, years) {
    var n = Math.round(years * 12), r = annualRate / 12;
    var f = Math.pow(1 + r, n);
    var fv = r === 0 ? start + monthly * n : start * f + monthly * (f - 1) / r;
    var contributed = start + monthly * n;
    var series = [];
    for (var y = 1; y <= Math.ceil(years); y++) {
      var m = Math.min(y * 12, n), g = Math.pow(1 + r, m);
      series.push(round2(r === 0 ? start + monthly * m : start * g + monthly * (g - 1) / r));
    }
    return { total: round2(fv), contributed: round2(contributed), interest: round2(fv - contributed), byYear: series };
  }

  // ---- Stamp duty on a car, by state -------------------------------------
  // Rates read from each revenue office on CAR_DUTY.checked; the pages name the URLs.
  // "Per $100 or part" means a part-$100 counts as a whole $100.
  var CAR_DUTY = {
    checked: "21 November 2026",
    // VIC: per $200 or part, one rate on the whole value (from 1 July 2026)
    vicBands: [{ upTo: 80809, rate: 8.40 }, { upTo: 100000, rate: 10.40 }, { upTo: 150000, rate: 14.00 }, { upTo: Infinity, rate: 18.00 }],
    vic: { green: 8.40, primary: 8.40, otherNew: 5.40, otherUsed: 8.40 },
    // QLD light vehicles: [$ per $100 up to $100,000, $ per $100 above], on the whole value
    qld: { ev: [2, 4], c4: [3, 5], c6: [3.5, 5.5], c8: [4, 6] },
    // ACT passenger and light commercial: [$ per $100 under $45,000, $ per $100 from $45,000 to $80,000];
    // $8 per $100 above $80,000 in every category. Used vehicles: AAA, or the "all other" row.
    act: {
      "2025": { AAA: [2.50, 4.00], AA: [2.67, 4.41], A: [2.84, 4.81], B: [3.00, 5.22], C: [3.17, 5.62], D: [4.53, 7.81], NR: [3.17, 5.62], usedOther: [3.17, 5.62] },
      "2027": { AAA: [2.50, 4.00], AA: [2.67, 4.41], A: [2.84, 4.81], B: [3.25, 5.59], C: [3.72, 6.44], D: [4.83, 8.00], NR: [3.72, 6.44], usedOther: [3.72, 6.44] },
      top: 8.00
    },
    ntEvFreeUpTo: 50000
  };

  // Number of whole units in a value, counting a part unit as whole.
  function units(x, unit) {
    x = Math.round(x * 100) / 100;
    return x > 0 ? Math.ceil(x / unit - 1e-9) : 0;
  }

  var carDutyByState = {
    // o.type: "passenger" | "other" (utes, vans, motorcycles)
    NSW: function (v, o) {
      if (o.type === "other" || v < 45000) return { duty: 3 * units(v, 100), how: "$3 per $100" };
      return { duty: 1350 + 5 * units(v - 45000, 100), how: "$1,350 + $5 per $100 over $45,000" };
    },
    // o.type: "passenger" | "green" | "primary" | "otherNew" | "otherUsed"
    VIC: function (v, o) {
      var rate, how;
      if (o.type && o.type !== "passenger") {
        rate = CAR_DUTY.vic[o.type];
        how = "$" + rate.toFixed(2) + " per $200";
      } else {
        var b = CAR_DUTY.vicBands;
        for (var i = 0; i < b.length; i++) if (v <= b[i].upTo) { rate = b[i].rate; break; }
        how = "$" + rate.toFixed(2) + " per $200 on the whole value";
      }
      return { duty: round2(rate * units(v, 200)), how: how };
    },
    // o.engine: "ev" (hybrid or electric) | "c4" | "c6" | "c8"
    QLD: function (v, o) {
      var r = CAR_DUTY.qld[o.engine || "c4"], high = v > 100000, rate = high ? r[1] : r[0];
      return { duty: round2(rate * units(v, 100)), how: "$" + rate.toFixed(2) + " per $100 on the whole value" };
    },
    // o.type: "passenger" (non-commercial) | "other" (commercial: utes, vans)
    SA: function (v, o) {
      var com = o.type === "other";
      if (v <= 1000) return { duty: Math.max(5, units(v, 100)), how: "$1 per $100, minimum $5" };
      if (v <= 2000) return { duty: 10 + 2 * units(v - 1000, 100), how: "$10 + $2 per $100 over $1,000" };
      if (com || v <= 3000) return { duty: 30 + 3 * units(v - 2000, 100), how: "$30 + $3 per $100 over $2,000" };
      return { duty: 60 + 4 * units(v - 3000, 100), how: "$60 + $4 per $100 over $3,000" };
    },
    WA: function (v) {
      var pct;
      if (v <= 25000) pct = 2.75;
      else if (v <= 50000) pct = Math.round((2.75 + (v - 25000) / 6666.66) * 100) / 100;
      else pct = 6.5;
      return { duty: round2(v * pct / 100), how: pct.toFixed(2) + "% of the whole value" };
    },
    // o.type: "passenger" | "other" (utes, vans, motorcycles) | "fleet" (new, manufacturer fleet discount)
    TAS: function (v, o) {
      if (o.type === "other") return { duty: Math.max(20, 3 * units(v, 100)), how: "$3 per $100, minimum $20" };
      if (o.type === "fleet") return { duty: round2(Math.max(20, 3.5 * units(v, 100))), how: "$3.50 per $100, minimum $20" };
      if (v <= 600) return { duty: 20, how: "flat $20" };
      if (v <= 35000) return { duty: 3 * units(v, 100), how: "$3 per $100" };
      if (v <= 40000) return { duty: 1050 + 11 * units(v - 35000, 100), how: "$1,050 + $11 per $100 over $35,000" };
      return { duty: 4 * units(v, 100), how: "$4 per $100 on the whole value" };
    },
    // o.period: "2025" (to 31 Jan 2027) | "2027" (from 1 Feb 2027); o.isNew; o.cat: AAA AA A B C D NR
    ACT: function (v, o) {
      var t = CAR_DUTY.act[o.period || "2025"];
      var cat = o.isNew ? (o.cat || "C") : (o.cat === "AAA" ? "AAA" : "usedOther");
      var r = t[cat];
      var base45 = round2(450 * r[0]), base80 = round2(base45 + 350 * r[1]);
      var $ = function (x) { return "$" + x.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); };
      if (v < 45000) return { duty: round2(r[0] * units(v, 100)), how: $(r[0]) + " per $100" };
      if (v <= 80000) return { duty: round2(base45 + r[1] * units(v - 45000, 100)), how: $(base45) + " + " + $(r[1]) + " per $100 over $45,000" };
      return { duty: round2(base80 + CAR_DUTY.act.top * units(v - 80000, 100)), how: $(base80) + " + $8.00 per $100 over $80,000" };
    },
    // o.ev: battery electric or plug-in hybrid (concession to 30 June 2027)
    NT: function (v, o) {
      if (o.ev) {
        var over = Math.max(0, v - CAR_DUTY.ntEvFreeUpTo);
        return { duty: 3 * units(over, 100), how: "EV concession: $3 per $100 over $50,000" };
      }
      return { duty: 3 * units(v, 100), how: "$3 per $100" };
    }
  };

  // Stamp duty on registering or transferring a light vehicle in `state`.
  function carDuty(state, value, opts) {
    var v = value > 0 ? value : 0;
    var r = carDutyByState[state](v, opts || {});
    return { duty: round2(r.duty), how: r.how, effectiveRate: v > 0 ? r.duty / v : 0 };
  }

  // ---- QLD vehicle registration duty, with the working shown ------------
  // Dutiable value (qld.gov.au "About vehicle registration duty"):
  //   new car with a list price: list price (incl. GST and LCT) + optional equipment
  //   used car, or no list price: the higher of the total paid (deposit, trade-in
  //   allowance, dealer delivery, warranties, options) and the market value
  //   either way, less the cost of modifications for a person with a disability
  // o: { isNew, listPrice, options, paid, market, disabilityMods }
  function qldDutiableValue(o) {
    var v = o.isNew ? (o.listPrice || 0) + (o.options || 0) : Math.max(o.paid || 0, o.market || 0);
    return Math.max(0, v - (o.disabilityMods || 0));
  }

  // o.engine: "ev" | "c4" | "c6" | "c8"; o.cls: "light" (default) | "heavy" (over 4.5 t GVM) | "special" ($25)
  function qldDuty(value, o) {
    o = o || {};
    var v = value > 0 ? value : 0;
    if (o.cls === "special") return { duty: 25, hundreds: 0, rate: 0, high: false, how: "flat $25" };
    var r = CAR_DUTY.qld[o.engine || "c4"];
    var high = o.cls !== "heavy" && v > 100000;
    var rate = high ? r[1] : r[0], n = units(v, 100);
    // what the same car would pay on the other side of the $100,000 line
    var atLine = r[0] * 1000, justOver = r[1] * 1001;
    return { duty: round2(rate * n), hundreds: n, rate: rate, high: high, atLine: atLine, justOver: justOver,
      how: "$" + rate.toFixed(2) + " per $100 on the whole value" };
  }

  // ---- Registration costs (12 months, private use) -----------------------
  var REGO = {
    checked: "26 November 2026",
    // QLD light vehicles up to 4 t, "cost as at 1 October 2026" (qld.gov.au registration fees)
    qld: {
      rego: { c3: 303.10, c4: 385.45, c6: 610.30, c8: 854.70, c12: 1002.35 },
      concession: { c3: 151.55, c4: 192.75, c6: 305.15, c8: 427.35, c12: 501.20 }, // card from 1 July 1994
      concessionPre1994: 108.60, // any vehicle up to 4 t
      tif: 67.25, ctp: [411.80, 427.80], transfer: 33.65, plates: 36.25
    },
    // SA, 12 months incl. CTP estimate and admin fee, effective 1 July 2026 (sa.gov.au)
    sa: { metro: { c4: 705, c6: 875, c8: 1025 }, country: { c4: 585, c6: 755, c8: 900 } },
    // VIC sedan/wagon/hatch/SUV, annual fee incl. TAC charge (vicroads.vic.gov.au)
    vic: { metro: 958.80, outer: 897.10, rural: 824.60 }
  };

  // QLD 12-month registration. cyl: "c3" (1-3 cylinders or electric) | "c4" | "c6" | "c8" | "c12"
  // concession: "" | "card" (issued from 1 July 1994) | "pre1994"
  function qldRego(cyl, concession) {
    var q = REGO.qld, fee = concession === "pre1994" ? q.concessionPre1994
      : concession === "card" ? q.concession[cyl] : q.rego[cyl];
    return { rego: fee, tif: q.tif, ctpLow: q.ctp[0], ctpHigh: q.ctp[1],
      low: round2(fee + q.tif + q.ctp[0]), high: round2(fee + q.tif + q.ctp[1]) };
  }

  // ---- Drive-away price for a new car --------------------------------------
  // o: { state, price, options, delivery, dutyOnDelivery, dutyOpts, rego (12 months incl. CTP), other }
  function driveaway(o) {
    var dutiable = (o.price || 0) + (o.options || 0) + (o.dutyOnDelivery ? (o.delivery || 0) : 0);
    var d = carDuty(o.state, dutiable, o.dutyOpts);
    var total = (o.price || 0) + (o.options || 0) + (o.delivery || 0) + d.duty + (o.rego || 0) + (o.other || 0);
    return { dutiable: dutiable, duty: d.duty, how: d.how, total: round2(total) };
  }

  var api = {
    RATES: RATES, SOLAR_YIELD: SOLAR_YIELD, CAR_DUTY: CAR_DUTY, carDuty: carDuty,
    REGO: REGO, qldDutiableValue: qldDutiableValue, qldDuty: qldDuty, qldRego: qldRego, driveaway: driveaway,
    incomeTax: incomeTax, lito: lito, medicareLevy: medicareLevy, payAfterTax: payAfterTax,
    marginalRate: marginalRate, gst: gst, repayment: repayment, mortgage: mortgage,
    superGuarantee: superGuarantee, salaryConvert: salaryConvert, casualToPermanent: casualToPermanent,
    fuelTrip: fuelTrip, applianceCost: applianceCost, evVsPetrol: evVsPetrol,
    solarPayback: solarPayback, compoundSavings: compoundSavings
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
