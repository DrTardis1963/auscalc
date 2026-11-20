// Checks the formulas against hand-worked figures, including every worked
// example printed on the pages. Run: node tests/check.js
"use strict";
const C = require("../src/assets/formulas.js");

let fails = 0;
function eq(label, got, want, tol = 0.01) {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) { fails++; console.log(`FAIL ${label}: got ${got}, want ${want}`); }
}

// Income tax brackets (ATO 2026-27)
eq("tax 18200", C.incomeTax(18200), 0);
eq("tax 45000", C.incomeTax(45000), 4020);
eq("tax 135000", C.incomeTax(135000), 31020);
eq("tax 190000", C.incomeTax(190000), 51370);
eq("tax 200000", C.incomeTax(200000), 55870);

// LITO (ATO)
eq("lito 37500", C.lito(37500), 700);
eq("lito 45000", C.lito(45000), 325);
eq("lito 66667", C.lito(66667), 0, 0.02);
eq("lito 70000", C.lito(70000), 0);

// Medicare low-income (ATO example: $29,000 -> $98.90)
eq("medicare 28011", C.medicareLevy(28011), 0);
eq("medicare 29000", C.medicareLevy(29000), 98.9);
eq("medicare 80000", C.medicareLevy(80000), 1600);

// pay-after-tax page
let p = C.payAfterTax(80000);
eq("pay 80k net", p.net, 63880); eq("pay 80k tax", p.incomeTax, 14520); eq("pay 80k super", p.super, 9600);
eq("pay 80k fortnight", Math.round(p.net / 26 * 100) / 100, 2456.92);
eq("pay 80k marginal", p.marginalRate, 0.32);
p = C.payAfterTax(35000);
eq("pay 35k net", p.net, 32481.1); eq("pay 35k medicare", p.medicare, 698.9);
eq("pay 35k avg", Math.round(p.effectiveRate * 1000) / 1000, 0.072, 0.001);
eq("pay 18000 net", C.payAfterTax(18000).net, 18000);

// gst page
eq("gst add", C.gst(250, "add").incGst, 275);
eq("gst remove", C.gst(99, "remove").gst, 9);
eq("gst 1650", C.gst(1650, "remove").exGst, 1500);

// mortgage page
let m = C.mortgage(600000, 0.06, 30);
eq("loan monthly", m.monthly, 3597.30);
eq("loan interest", m.totalInterest, 695029, 1);
eq("loan io", m.interestOnlyMonthly, 3000);
eq("loan fortnightly", m.fortnightly, 1659.50);
eq("loan accel payment", m.accelerated.payment, 1798.65);
eq("loan accel years", m.accelerated.years, 24.5, 0.1);
eq("loan accel saved", m.accelerated.interestSaved, 149000, 1000);
const step = C.mortgage(600000, 0.0625, 30).monthly - m.monthly;
eq("loan +0.25% ~ $100", step, 100, 10);

// super page
let s = C.superGuarantee(90000, false);
eq("sg 90k", s.yearly, 10800); eq("sg 90k fn", s.fortnightly, 415.38);
s = C.superGuarantee(100000, true);
eq("sg pkg base", s.base, 89285.71); eq("sg pkg super", s.yearly, 10714.29);

// salary converter page
let c = C.salaryConvert(35, "hour", 38);
eq("conv week", c.weekly, 1330); eq("conv year", c.annual, 69160); eq("conv month", c.monthly, 5763.33);
eq("casual 40", C.casualToPermanent(40), 32);

// fuel page
let t = C.fuelTrip(880, 7.5, 2.0, true, 3);
eq("fuel litres", t.litres, 132); eq("fuel cost", t.cost, 264); eq("fuel each", t.perPerson, 88);

// appliance page
let a = C.applianceCost(2400, 4, 33);
eq("heater day", a.perDay, 3.17); eq("heater quarter", a.perQuarter, 289, 0.5);
a = C.applianceCost(800, 4, 33);
eq("split day", a.perDay, 1.06); eq("split quarter", a.perQuarter, 96, 0.5);
eq("standby year", C.applianceCost(30, 24, 33).perYear, 87, 0.5);

// ev page
let e = C.evVsPetrol(12000, 7.5, 1.95, 16, 30);
eq("ev petrol yr", e.petrolPerYear, 1755); eq("ev home yr", e.evPerYear, 576); eq("ev save", e.savingPerYear, 1179);
eq("ev offpeak", C.evVsPetrol(12000, 7.5, 1.95, 16, 15).evPerYear, 288);
eq("ev fast", C.evVsPetrol(12000, 7.5, 1.95, 16, 60).evPerYear, 1152);

// solar page
let so = C.solarPayback(6.6, 5500, C.SOLAR_YIELD.Brisbane, 40, 32, 5);
eq("solar gen", so.generation, 10118); eq("solar save", so.savingPerYear, 1599, 1);
eq("solar payback", so.paybackYears, 3.5, 0.1);

// savings page
let sv = C.compoundSavings(5000, 200, 0.045, 10);
eq("save total", sv.total, 38075, 1); eq("save interest", sv.interest, 9075, 1);
eq("save y10 interest", sv.byYear[9] - sv.byYear[8] - 2400, 1615, 1);

// super page claim: $10,800/yr for 30 years at 6% ~ $850k
let fv = 0; for (let y = 0; y < 30; y++) fv = fv * 1.06 + 10800;
eq("super 30y", fv, 850000, 10000);

if (fails) { console.log(`${fails} check(s) failed`); process.exit(1); }
console.log("All formula checks passed");
