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

  var api = {
    RATES: RATES, SOLAR_YIELD: SOLAR_YIELD,
    incomeTax: incomeTax, lito: lito, medicareLevy: medicareLevy, payAfterTax: payAfterTax,
    marginalRate: marginalRate, gst: gst, repayment: repayment, mortgage: mortgage,
    superGuarantee: superGuarantee, salaryConvert: salaryConvert, casualToPermanent: casualToPermanent,
    fuelTrip: fuelTrip, applianceCost: applianceCost, evVsPetrol: evVsPetrol,
    solarPayback: solarPayback, compoundSavings: compoundSavings
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Calc = api;
})(this);
