// SeatCraft engine - event seating chart solver (no DOM)
(function (root) {
  'use strict';

  var TAG_PAIR = 2;       // bonus per same-tag pair sharing a table
  var WITH_TOGETHER = 10; // must-sit-together honored
  var WITH_APART = -10;   // must-sit-together broken
  var AVOID_SAME = -50;   // avoid pair at the same table
  var UNSEATED = -5;      // per unseated guest

  // Lines of "Name, tag" -> [{name, tag}]. Tag optional (defaults to 'guest').
  function parseGuests(text) {
    var out = [];
    String(text || '').split('\n').forEach(function (line) {
      var t = line.trim();
      if (!t) return;
      var parts = t.split(',');
      out.push({ name: parts[0].trim(), tag: (parts[1] || 'guest').trim().toLowerCase() });
    });
    return out;
  }

  // Lines of "A <> B" (avoid) or "A = B" (with) -> [[a, b], ...]
  function parsePairs(text, sep) {
    var out = [];
    String(text || '').split('\n').forEach(function (line) {
      var t = line.trim();
      if (!t || t.indexOf(sep) === -1) return;
      var parts = t.split(sep);
      var a = parts[0].trim().toLowerCase(), b = (parts[1] || '').trim().toLowerCase();
      if (a && b) out.push([a, b]);
    });
    return out;
  }

  function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  function toMap(pairs) {
    var m = {};
    pairs.forEach(function (p) { m[pairKey(p[0], p[1])] = true; });
    return m;
  }

  // seating: array parallel to guests, table index or -1 (unseated).
  function score(guests, tables, avoidPairs, withPairs, seating) {
    var s = 0, i, j;
    var avoid = toMap(avoidPairs), withM = toMap(withPairs);
    for (i = 0; i < guests.length; i++) if (seating[i] === -1) s += UNSEATED;
    for (i = 0; i < guests.length; i++) {
      for (j = i + 1; j < guests.length; j++) {
        var k = pairKey(guests[i].name.toLowerCase(), guests[j].name.toLowerCase());
        var sameTable = seating[i] !== -1 && seating[i] === seating[j];
        if (sameTable && guests[i].tag === guests[j].tag) s += TAG_PAIR;
        if (avoid[k] && sameTable) s += AVOID_SAME;
        if (withM[k]) {
          if (sameTable) s += WITH_TOGETHER;
          else s += WITH_APART;
        }
      }
    }
    return s;
  }

  function freeSeats(tables, seating) {
    var used = tables.map(function () { return 0; });
    seating.forEach(function (t) { if (t !== -1) used[t]++; });
    return tables.map(function (t, i) { return t.capacity - used[i]; });
  }

  // Greedy seed + deterministic local search (swaps and moves).
  function seat(guests, tables, avoidPairs, withPairs) {
    var n = guests.length;
    var seating = new Array(n).fill(-1);
    var constraintCount = guests.map(function (g) {
      var nm = g.name.toLowerCase(), c = 0;
      avoidPairs.concat(withPairs).forEach(function (p) { if (p[0] === nm || p[1] === nm) c++; });
      return c;
    });
    var order = guests.map(function (_, i) { return i; });
    order.sort(function (a, b) {
      if (constraintCount[b] !== constraintCount[a]) return constraintCount[b] - constraintCount[a];
      return guests[a].name.toLowerCase() < guests[b].name.toLowerCase() ? -1 : 1;
    });
    // greedy seed: best table by score delta
    order.forEach(function (gi) {
      var bestT = -1, bestS = -Infinity;
      var free = freeSeats(tables, seating);
      for (var t = 0; t < tables.length; t++) {
        if (free[t] <= 0) continue;
        seating[gi] = t;
        var s = score(guests, tables, avoidPairs, withPairs, seating);
        if (s > bestS) { bestS = s; bestT = t; }
        seating[gi] = -1;
      }
      if (bestT !== -1) seating[gi] = bestT;
    });
    // local search: moves then swaps, repeat until stable
    var evals = 0, improved = true;
    while (improved && evals < 4000) {
      improved = false;
      var base = score(guests, tables, avoidPairs, withPairs, seating);
      // single moves
      for (var gi2 = 0; gi2 < n; gi2++) {
        if (seating[gi2] === -1) continue;
        var from = seating[gi2];
        for (var t2 = 0; t2 < tables.length; t2++) {
          if (t2 === from) continue;
          var free2 = freeSeats(tables, seating);
          if (free2[t2] <= 0) continue;
          seating[gi2] = t2; evals++;
          var s2 = score(guests, tables, avoidPairs, withPairs, seating);
          if (s2 > base) { base = s2; improved = true; from = t2; }
          else seating[gi2] = from;
        }
      }
      // swaps
      for (var a = 0; a < n; a++) {
        if (seating[a] === -1) continue;
        for (var b = a + 1; b < n; b++) {
          if (seating[b] === -1 || seating[b] === seating[a]) continue;
          var tmp = seating[a]; seating[a] = seating[b]; seating[b] = tmp; evals++;
          var s3 = score(guests, tables, avoidPairs, withPairs, seating);
          if (s3 > base) { base = s3; improved = true; }
          else { tmp = seating[a]; seating[a] = seating[b]; seating[b] = tmp; }
        }
      }
    }
    return seating;
  }

  // Human-readable violations of a seating.
  function violations(guests, tables, avoidPairs, withPairs, seating) {
    var out = [];
    var avoid = toMap(avoidPairs), withM = toMap(withPairs);
    for (var i = 0; i < guests.length; i++) {
      for (var j = i + 1; j < guests.length; j++) {
        var k = pairKey(guests[i].name.toLowerCase(), guests[j].name.toLowerCase());
        var sameTable = seating[i] !== -1 && seating[i] === seating[j];
        if (avoid[k] && sameTable) out.push({ type: 'avoid', a: guests[i].name, b: guests[j].name, table: seating[i] });
        if (withM[k] && !sameTable) out.push({ type: 'with', a: guests[i].name, b: guests[j].name });
      }
    }
    return out;
  }

  function summary(guests, tables, seating) {
    var used = tables.map(function () { return 0; }), unseated = [];
    seating.forEach(function (t, i) { if (t === -1) unseated.push(guests[i].name); else used[t]++; });
    var empty = 0, tablesUsed = 0;
    tables.forEach(function (t, i) { if (used[i] > 0) tablesUsed++; empty += t.capacity - used[i]; });
    return { tablesUsed: tablesUsed, emptySeats: empty, unseated: unseated };
  }

  var api = { parseGuests: parseGuests, parsePairs: parsePairs, score: score,
    seat: seat, violations: violations, summary: summary, freeSeats: freeSeats,
    TAG_PAIR: TAG_PAIR, WITH_TOGETHER: WITH_TOGETHER, WITH_APART: WITH_APART,
    AVOID_SAME: AVOID_SAME, UNSEATED: UNSEATED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SeatEngine = api;
})(typeof self !== 'undefined' ? self : this);
