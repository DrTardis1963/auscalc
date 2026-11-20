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

// ---- car stamp duty pages (rates checked 21 Nov 2026) ----
const d = (s, v, o) => C.carDuty(s, v, o).duty;
// NSW page
eq("nsw 30k", d("NSW", 30000, { type: "passenger" }), 900);
eq("nsw 44,999", d("NSW", 44999, { type: "passenger" }), 1350);
eq("nsw 50k", d("NSW", 50000, { type: "passenger" }), 1600);
eq("nsw 60k", d("NSW", 60000, { type: "passenger" }), 2100);
eq("nsw ute 60k", d("NSW", 60000, { type: "other" }), 1800);
eq("nsw part $100", d("NSW", 30050, { type: "passenger" }), 903);
// VIC page (per $200, whole value)
eq("vic 45k", d("VIC", 45000, { type: "passenger" }), 1890);
eq("vic 80,809", d("VIC", 80809, { type: "passenger" }), 3402);
eq("vic 81k", d("VIC", 81000, { type: "passenger" }), 4212);
eq("vic 90k",d("VIC", 90000, { type: "passenger" }), 4680);
eq("vic 90k green", d("VIC", 90000, { type: "green" }), 3780);
eq("vic 120k", d("VIC", 120000, { type: "passenger" }), 8400);
eq("vic ute new 50k", d("VIC", 50000, { type: "otherNew" }), 1350);
eq("vic ute used 50k", d("VIC", 50000, { type: "otherUsed" }), 2100);
eq("vic part $200", d("VIC", 45001, { type: "passenger" }), 1898.4);
// QLD page (QLD's own calculator: $110,050, 4 cyl -> $5,505)
eq("qld 45k 4cyl", d("QLD", 45000, { engine: "c4" }), 1350);
eq("qld 45k hybrid", d("QLD", 45000, { engine: "ev" }), 900);
eq("qld 45k 6cyl", d("QLD", 45000, { engine: "c6" }), 1575);
eq("qld 80k v8", d("QLD", 80000, { engine: "c8" }), 3200);
eq("qld 110,050 4cyl", d("QLD", 110050, { engine: "c4" }), 5505);
eq("qld 100k ev", d("QLD", 100000, { engine: "ev" }), 2000);
eq("qld 100,100 ev", d("QLD", 100100, { engine: "ev" }), 4004);
// SA page
eq("sa 40k", d("SA", 40000, { type: "passenger" }), 1540);
eq("sa ute 40k", d("SA", 40000, { type: "other" }), 1170);
eq("sa 800", d("SA", 800, { type: "passenger" }), 8);
eq("sa 300 min", d("SA", 300, { type: "passenger" }), 5);
eq("sa 2500", d("SA", 2500, { type: "passenger" }), 45);
eq("sa 15k", d("SA", 15000, { type: "passenger" }), 540);
// WA page
eq("wa 20k", d("WA", 20000), 550);
eq("wa 30k", d("WA", 30000), 1050);
eq("wa 40k", d("WA", 40000), 2000);
eq("wa 60k", d("WA", 60000), 3900);
eq("wa 50k", d("WA", 50000), 3250);
// TAS page
eq("tas 500", d("TAS", 500, { type: "passenger" }), 20);
eq("tas 35k", d("TAS", 35000, { type: "passenger" }), 1050);
eq("tas 38k", d("TAS", 38000, { type: "passenger" }), 1380);
eq("tas 40k", d("TAS", 40000, { type: "passenger" }), 1600);
eq("tas 50k", d("TAS", 50000, { type: "passenger" }), 2000);
eq("tas ute 50k", d("TAS", 50000, { type: "other" }), 1500);
eq("tas fleet 40k", d("TAS", 40000, { type: "fleet" }), 1400);
// ACT page: the built-up bases must match the published table
const act = (v, o) => d("ACT", v, Object.assign({ period: "2025" }, o));
eq("act base45 B 2025", act(45000, { isNew: true, cat: "B" }), 1350);
eq("act base80 B 2025", act(80000, { isNew: true, cat: "B" }), 3177);
eq("act base80 D 2025", act(80000, { isNew: true, cat: "D" }), 4772);
eq("act base80 AA", act(80000, { isNew: true, cat: "AA" }), 2745);
eq("act base80 A", act(80000, { isNew: true, cat: "A" }), 2961.5);
eq("act base80 AAA", act(80000, { isNew: true, cat: "AAA" }), 2525);
eq("act base80 C 2027", act(80000, { isNew: true, cat: "C", period: "2027" }), 3928);
eq("act base80 D 2027", act(80000, { isNew: true, cat: "D", period: "2027" }), 4973.5);
eq("act base80 B 2027", act(80000, { isNew: true, cat: "B", period: "2027" }), 3419);
eq("act new B 50k", act(50000, { isNew: true, cat: "B" }), 1611);
eq("act new B 50k 2027", act(50000, { isNew: true, cat: "B", period: "2027" }), 1742);
eq("act new AAA 50k", act(50000, { isNew: true, cat: "AAA" }), 1325);
eq("act new D 50k", act(50000, { isNew: true, cat: "D" }), 2429);
eq("act used 20k", act(20000, { isNew: false }), 634);
eq("act used 20k 2027", act(20000, { isNew: false, period: "2027" }), 744);
eq("act used EV 20k", act(20000, { isNew: false, cat: "AAA" }), 500);
eq("act 100k AAA", act(100000, { isNew: true, cat: "AAA" }), 4125);
// NT page
eq("nt 50k", d("NT", 50000, {}), 1500);
eq("nt ev 45k", d("NT", 45000, { ev: true }), 0);
eq("nt ev 60k", d("NT", 60000, { ev: true }), 300);
eq("nt 60k", d("NT", 60000, {}), 1800);
// WA page claim: from $55k to $95k WA beats every other state's dearest option (either ACT period)
const dearest = {
  NSW: [{ type: "passenger" }], VIC: [{ type: "passenger" }], QLD: [{ engine: "c8" }], SA: [{ type: "passenger" }],
  TAS: [{ type: "passenger" }], NT: [{}],
  ACT: [{ isNew: true, cat: "D", period: "2025" }, { isNew: true, cat: "D", period: "2027" }]
};
for (let v = 55000; v <= 95000; v += 5000) {
  let top = 0;
  for (const s in dearest) for (const o of dearest[s]) top = Math.max(top, d(s, v, o));
  if (!(d("WA", v) > top)) { fails++; console.log(`FAIL WA not highest at ${v}: ${d("WA", v)} vs ${top}`); }
}
// hub page comparison: $50,000 new petrol / EV, $20,000 used petrol
const hub = {
  NSW: [{ type: "passenger" }, { type: "passenger" }, 1600, 1600, 600],
  VIC: [{ type: "passenger" }, { type: "green" }, 2100, 2100, 840],
  QLD: [{ engine: "c4" }, { engine: "ev" }, 1500, 1000, 600],
  SA: [{ type: "passenger" }, { type: "passenger" }, 1940, 1940, 740],
  WA: [{}, {}, 3250, 3250, 550],
  TAS: [{ type: "passenger" }, { type: "passenger" }, 2000, 2000, 600],
  ACT: [{ isNew: true, cat: "B" }, { isNew: true, cat: "AAA" }, 1611, 1325, 634],
  NT: [{}, { ev: true }, 1500, 0, 600]
};
for (const s in hub) {
  const [po, eo, p50, e50, u20] = hub[s];
  eq(`hub ${s} petrol 50k`, d(s, 50000, po), p50);
  eq(`hub ${s} ev 50k`, d(s, 50000, eo), e50);
  eq(`hub ${s} used 20k`, d(s, 20000, s === "ACT" ? { isNew: false } : po), u20);
}

if (fails) { console.log(`${fails} check(s) failed`); process.exit(1); }
console.log("All formula checks passed");
