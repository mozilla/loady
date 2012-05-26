/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const display = require('./display'),
      stats = require('./stats'),
      winston = require('winston');

exports.userdb = require('./user_db');

exports.run = function (serverConfig, activities, args) {

  // activities complete since the last poll
  var completed = {
  };

  // TODO - 40 is # of activities per day and should come from Script Config



  var activitiesToRun = Object.keys(activities);


  Object.keys(activities).forEach(function(act) {
    stats.outstanding[act] = 0;
  });

  Object.keys(activities).forEach(function(k) {
    var sum = 0;
    if (stats.probs.length) sum = stats.probs[stats.probs.length - 1][0];
    sum += activities[k].probability;
    stats.probs.push([sum, k]);
  });
  // and normalize stats.probs into 0..1
  (function() {
    var max = stats.probs[stats.probs.length - 1][0];
    for (var i = 0; i < stats.probs.length; i++) {
      stats.probs[i][0] /= max;
    }
  })();


  // a global count of how many poll iterations have been completed
  var iterations = 0;



  function poll() {
    function startNewActivity() {
      // what type of activity is this?
      var n = Math.random();
      var act = undefined;
      for (var i = 0; i < stats.probs.length; i++) {
        if (n <= stats.probs[i][0]) {
          act = stats.probs[i][1];
          break;
        }
      }
      // start the activity! (if it is enabled)
      if (activitiesToRun.indexOf(act) !== -1) {
        stats.outstanding[act]++;
        activities[act].startFunc(serverConfig, function(err) {
          stats.outstanding[act]--;
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

    function updateAverages(elapsed) {
      if (!iterations) return;

      var numActCompleted = 0;
      Object.keys(completed).forEach(function(k) {
        numActCompleted += completed[k][0];
        stats.numErrors += completed[k][1];
        stats.num503s += completed[k][2];
      });
      completed = { };
      var avgUsersThisPeriod = (numActCompleted / stats.activitiesPerUserPerSecond) * (elapsed / 1000);

      // the 1s average is a goldfish.
      stats.averages[0] = avgUsersThisPeriod;

      // for 5s and 60s averages, a little special logic to handle cases
      // where we don't have enough history to dampen based on past performance
      var i = 5 > iterations ? iterations * 1.0 : 5.0;
      stats.averages[1] = ((i-1) * stats.averages[1] + avgUsersThisPeriod) / i;
      i = 60 > iterations ? iterations * 1.0 : 60.0;
      stats.averages[2] = ((i-1) * stats.averages[2] + avgUsersThisPeriod) / i;
    }



    // ** how much time has elapsed since the last poll?
    var elapsed;
    {
      var now = new Date();
      elapsed = now - stats.lastPoll;
      stats.lastPoll = now;
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
      if (stats.averages[0] > 10000) targetActive = stats.averages[0] * 1.5;
      else targetActive = 10000;
    }

    // now how many new activities do we want to start?
    var newAct = stats.activitiesPerUserPerSecond * targetActive;

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
    while (newAct >= 1.0 && stats.numOutstanding() < (stats.activitiesPerUserPerSecond * targetActive * 2)) {
      stats.numStarted++;
      startNewActivity();
      newAct--;
    }

    // ** schedule another wake up
    var wakeUpIn = 1000 - (new Date() - stats.lastPoll);
    setTimeout(poll, wakeUpIn);

    // display averages
    display.outputAverages(stats);

    iterations++;
  } // function poll

  // always start out by creating a bunch of users
  var NUM_INITIAL_USERS = 100;

  // if an explicit target was specified, let's output what that means
  // in understandable terms
  if (args.m) display.outputActiveUserSummary(args.m, stats);

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
  var users = args.m;
  if (! users) users = 10000;

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
        console.log("Simulating " + users + " active daily users, who do 40 activities per day");
        console.log("Average active users simulated over the last 1s/5s/60s:");
        poll();
      }
    });
  }
};