/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const winston = require('winston');

exports.userdb = require('./user_db');

exports.run = function (serverConfig, activities, args) {
  // last time we updated stats and added work if necc.
  var lastPoll = new Date();

  // average active users simulated over the last second, 5s, and 60s
  var averages = [
    0.0,
    0.0,
    0.0
  ];

  // activities complete since the last poll
  var completed = {
  };

  // TODO - 40 is # of activities per day and should come from Script Config

  // how many activies does an active user undertake per second
  const activitiesPerUserPerSecond = (40.0 / ( 24 * 60 * 60 ));

  var activitiesToRun = Object.keys(activities);
  // outstanding incomplete activites
  var outstanding = { };

  Object.keys(activities).forEach(function(act) {
    outstanding[act] = 0;
  });
  function numOutstanding() {
    var n = 0;
    Object.keys(outstanding).forEach(function(act) {
      n += outstanding[act];
    });
    return n;
  }
  // probs is a 2d array mapping normalized probabilities from 0-1 to
  // activities, used when determining what activity to perform next
  // [
  //    [0.002, 'login'], [0.997, 'include_js'], ...
  // ]
  var probs = [];
  Object.keys(activities).forEach(function(k) {
    var sum = 0;
    if (probs.length) sum = probs[probs.length - 1][0];
    sum += activities[k].probability;
    probs.push([sum, k]);
  });
  // and normalize probs into 0..1
  (function() {
    var max = probs[probs.length - 1][0];
    for (var i = 0; i < probs.length; i++) {
      probs[i][0] /= max;
    }
  })();


  // a global count of how many poll iterations have been completed
  var iterations = 0;

  // output a textual summary of how many activites per second are
  // associated with the given number of active users
  function outputActiveUserSummary(activeUsers) {
    console.log("with", activeUsers, "active users there will be:");
    for (var i = 0; i < probs.length; i++) {
      var p = probs[i][0];
      if (i !== 0) p -= probs[i-1][0];
      var n = p * activeUsers * activitiesPerUserPerSecond;
      console.log(" ", n.toFixed(2), probs[i][1], "activites per second");
    }
  }

  function poll() {
    function startNewActivity() {
      // what type of activity is this?
      var n = Math.random();
      var act = undefined;
      for (var i = 0; i < probs.length; i++) {
        if (n <= probs[i][0]) {
          act = probs[i][1];
          break;
        }
      }
      // start the activity! (if it is enabled)
      if (activitiesToRun.indexOf(act) !== -1) {
        outstanding[act]++;
        activities[act].startFunc(serverConfig, function(err) {
          outstanding[act]--;
          if (undefined === completed[act]) completed[act] = [ 0, 0, 0 ];
          if (err) {
            if (typeof err != 'string') err = err.toString();
            if (err.indexOf('server is too busy') != -1) {
              // TODO magic numberes
              completed[act][2]++;
            } else {
              completed[act][1]++;
              winston.error('('+act+') ' + err);
            }
          } else {
            completed[act][0]++;
          }
        });
      } else {
        if (undefined === completed[act]) completed[act] = [ 0, 0, 0 ];
        completed[act][0]++;
      }
    }

    var numErrors = 0;
    var num503s = 0;
    var numStarted = 0;

    function updateAverages(elapsed) {
      if (!iterations) return;

      var numActCompleted = 0;
      Object.keys(completed).forEach(function(k) {
        numActCompleted += completed[k][0];
        numErrors += completed[k][1];
        num503s += completed[k][2];
      });
      completed = { };
      var avgUsersThisPeriod = (numActCompleted / activitiesPerUserPerSecond) * (elapsed / 1000);

      // the 1s average is a goldfish.
      averages[0] = avgUsersThisPeriod;

      // for 5s and 60s averages, a little special logic to handle cases
      // where we don't have enough history to dampen based on past performance
      var i = 5 > iterations ? iterations * 1.0 : 5.0;
      averages[1] = ((i-1) * averages[1] + avgUsersThisPeriod) / i;
      i = 60 > iterations ? iterations * 1.0 : 60.0;
      averages[2] = ((i-1) * averages[2] + avgUsersThisPeriod) / i;
    }

    function outputAverages() {
      var actSumString = numOutstanding() + " R, " + numStarted + " S";
      var actNums = [];
      Object.keys(outstanding).forEach(function(act) {
        actNums.push(outstanding[act] + act.substr(0,1) + act.substr(-1,1));
      });
      actSumString += " (" + actNums.join(' ') + ")";

      console.log("\t", averages[0].toFixed(2),
                  "\t", averages[1].toFixed(2),
                  "\t", averages[2].toFixed(2),
                  "\t", actSumString,
                  "\t", numErrors ? "(" + numErrors + " ERRORS!)" : "",
                  "\t", num503s ? " (" + num503s + " 503s)" : "");
    }

    // ** how much time has elapsed since the last poll?
    var elapsed;
    {
      var now = new Date();
      elapsed = now - lastPoll;
      lastPoll = now;
    }

    // ** update running averages **
    updateAverages(elapsed);

    // ** determine how many activities to start **

    // how many active users would we like to simulate
    var targetActive = args.m;

    // if we're not throttled, then we'll trying 150% as many as
    // we're simulating right now.  If we're not simulating at least
    // 10000 active users, that shall be our lower bound
    if (!targetActive) {
      if (averages[0] > 10000) targetActive = averages[0] * 1.5;
      else targetActive = 10000;
    }

    // now how many new activities do we want to start?
    var newAct = activitiesPerUserPerSecond * targetActive;

    // scale based on how much time has elapsed since the last poll
    // on every iteration except the first
    if (iterations) newAct *= (elapsed / 1000);

    // probabilistic rounding
    {
      var add = (newAct % 1.0) < Math.random() ? 0 : 1;
      newAct = Math.floor(newAct) + add;
    }

    // ** start activities **

    // start the new activites until they're all started, or until we've
    // got twice as many outstanding as would be required by the target we
    // want to hit (which means the server can't keep up).
    while (newAct >= 1.0 && numOutstanding() < (activitiesPerUserPerSecond * targetActive * 2)) {
      numStarted++;
      startNewActivity();
      newAct--;
    }

    // ** schedule another wake up
    var wakeUpIn = 1000 - (new Date() - lastPoll);
    setTimeout(poll, wakeUpIn);

    // display averages
    outputAverages();

    iterations++;
  } // function poll

  // always start out by creating a bunch of users
  var NUM_INITIAL_USERS = 100;

  // if an explicit target was specified, let's output what that means
  // in understandable terms
  if (args.m) outputActiveUserSummary(args.m);

  const userdb = require("./user_db.js");



  console.log("To start, let's create " + NUM_INITIAL_USERS + " users via the API.  One moment please...");

  var createUser;
  // Loady Scripts can do account creation
  if (activities['signup']) {
    createUser = activities['signup'].startFunc;
  // or we'll do the minimum for them
  } else {
    createUser = function (cfg, cb) {
      var user = userdb.getNewUser();
      if (!user) {
        winston.error(".getNewUser() should *never* return undefined!");
        process.exit(1);
      }
      userdb.addNewUser(user);
      cb(null);
    };
  }

  var created = 0;
  for (var i = 0; i < NUM_INITIAL_USERS; i++) {
    createUser(serverConfig, function(err) {
      if (err) {
        console.log("failed to create initial users! tragedy!  run away!:", err);
        process.exit(1);
      }
      process.stdout.write(".");
      if (++created == NUM_INITIAL_USERS) {
        process.stdout.write("\n\n");
        process.stdout.write("Activities Map:\n");
        activitiesToRun.forEach(function (key) {
          process.stdout.write('(#' + key.substr(0, 1) + key.substr(-1, 1) + ') is ' + key + '\n');
        });
        process.stdout.write("\n");
        console.log("Average active users simulated over the last 1s/5s/60s:");
        poll();
      }
    });
  }
};