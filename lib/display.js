/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* display.js Outputs stats to standard output */
// output a textual summary of how many activites per second are
  // associated with the given number of active users
exports.outputActiveUserSummary = function (activeUsers, stats) {
    console.log("with", activeUsers, "active users there will be:");
    for (var i = 0; i < stats.probs.length; i++) {
      var p = stats.probs[i][0];
      if (i !== 0) p -= stats.probs[i-1][0];
      var n = p * activeUsers * stats.activitiesPerUserPerSecond;
      console.log(" ", n.toFixed(2), stats.probs[i][1], "activites per second");
    }
};

exports.outputAverages = function (stats) {
  var actSumString = stats.numOutstanding() + " R, " + stats.numStarted + " S";
  var actNums = [];
  Object.keys(stats.outstanding).forEach(function(act) {
    actNums.push(stats.outstanding[act] + act.substr(0,1) + act.substr(-1,1));
  });
  actSumString += " (" + actNums.join(' ') + ")";

  console.log("\t", stats.averages[0].toFixed(2),
              "\t", stats.averages[1].toFixed(2),
              "\t", stats.averages[2].toFixed(2),
              "\t", actSumString,
              "\t", stats.numErrors ? "(" + stats.numErrors + " ERRORS!)" : "",
              "\t", stats.num503s ? " (" + stats.num503s + " 503s)" : "");
}