/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

 /* stats.js Represents the statistics tracked during load testing */

// how many activies does an active user undertake per second
exports.activitiesPerUserPerSecond = (40.0 / ( 24 * 60 * 60 ));

// last time we updated stats and added work if necc.
exports.lastPoll = new Date();

// average active users simulated over the last second, 5s, and 60s
exports.averages = [
  0.0,
  0.0,
  0.0
];

// probs is a 2d array mapping normalized probabilities from 0-1 to
// activities, used when determining what activity to perform next
// [
//    [0.002, 'login'], [0.997, 'include_js'], ...
// ]
exports.probs = [];


// outstanding incomplete activites
exports.outstanding = { };

exports.numStarted = 0;
exports.numErrors = 0;
exports.num503s = 0;

exports.numOutstanding = function () {
  var n = 0;
  Object.keys(exports.outstanding).forEach(function(act) {
    n += exports.outstanding[act];
  });
  return n;
}