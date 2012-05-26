Loady
=====

We'll have your services crying loady, loady, loady

Status
------

**Note:** This code is very early and not ready for use.

Loady is a load testing framework. You provide a config file and a set of
Node modules that simulate user activity. Loady will generate thousands of
requests per second. You can estimate maximum capacity, stress test code, etc.

Installation
------------

    npm install loady

Usage
-----

    ./node_module/.bin/loady -c ./tests/load_gen.js

Example Loady Script ``load_gen.js``:

    exports.config = function () {
      return {
        num_activities_per_day: 40,
        app_name: 'Foobar 5000',
        activities_dir: './lib/load/activities'
      };
    };

On average, a user does about 40 activities per day. We name the app for use
in --help. ``activities_dir`` is a path (relative to this config file) which
comntains all of our Activities.

Loady Activities
----------------

Your load testing is accomplished through a series of Loady Activities.
These are simply Node modules with a ``startFunc`` function and a
``probability`` float.

Example ``lib/load/activities/simple.js``:
    var common = require('../common');

    exports.probability = 30 / 40;
    exports.startFunc = function (cfg, cb) {
      common.requestHomepage(cfg, function (err, statusCode) {
        if (err) {
            cb(err);
        } else if (statusCode >= 500) {
            cb('too much load');
        } else if (statusCode !== 200) {
            cb('error');
        } else {
            cb(null);
        }
      }
    };

Which activity is run is random, but weighted by the probability. You'll
want to look at your different user activities and weight them accordingly. If
they sign up for an account once per year, this will be a very low number
(say 1 / 365 * 24 * 60 * 60) and if the sign in ever two weeks
(1 / 14 * 24 * 60 * 60) and if they hit an active_session activity almost
every time (39/40). Etc.

Loady will do the math to normalize the probabilities and make sure they all
add up to 100% and
scale them so that the frequency is roughly proportional over time.

As you change your application, you'll add new activities and may want to
tweak the probabilities on older activties.

Listing Loady Activities
------------------------

    $ ./node_module/.bin/loady -c ./tests/load_gen.js -l
    available activities: well_known, provision_no_session, auth, provision


User Database
-------------

Loady uses an in-memory representation of users. If you wish to control user
creation than add an Activity named ``signup``.

Here is the simplest possible example ``lib/load/activities/signup.js``:

    exports.startFunc = function (cfg, cb) {
        var user = userdb.getNewUser();
        if (!user) {
          winston.error(".getNewUser() should *never* return undefined!");
          process.exit(1);
        }
        userdb.addNewUser(user);
        cb(null);
      };

Reading Loady Output
--------------------

Average active users simulated over the last 1s/5s/60s:
    0.00    0.00    0.00    4 R, 4 S (4wn 0pn)
    8657.28     8657.28     8657.28     4 R, 5 S (4wn 0pn)
    10832.40    9744.84     9744.84     7 R, 8 S (7wn 0pn)
    17331.84    12273.84    12273.84    10 R, 12 S (10wn 0pn) (1 503s)
    25997.76    15704.82    15704.82    18 R, 18 S (18wn 0pn)
    38918.88    20347.63    20347.63    24 R, 27 S (24wn 0pn) (3 ERRORS!)

### ADU

The first three columns give you an idea of how many active daily users (ADU)
you can concurrently support. First column is on average in the last second,
how many users.
Similarly, the last column is averaged over the last 60 seconds.

### Activities

The R column is the number of activities that are still running.

The S column is the total number of activities started in the last second.

This is followed by a list of activites still running broken down by firsta
and last character of the activity name.

So for example:

    8657.28     8657.28     8657.28     4 R, 5 S (4wn 0pn)

4 **w**ake_o**n** activities are running. One other process was completed in
the last second. The typoe of the process completed is unknown, it could ahve
been a wn or pn.

### Errors

The output will also catch errors. These may be common as your app stabelizes
under load. Don't worry.

    8657.28     8657.28     8657.28     4 R, 7 S (4wn 0pn) (1 ERRORS!) (2 503s)

This indicates that 1 of the activities ended in an error condition and
2 of the activites finished with a 503.

Loady Options
-------------

Adding options to loady CLI
---------------------------

You can override or extend the command line options for loady to give yourself
hooks to your own load testing activities:


    var _ = require('underscore'),
          loady = require('loady');

    exports.config = function () {
      return {
        app_name: 'Foobar 5000',
        activities_dir: './lib/load/activities'
      };
    };

    exports.cli = function (defaults) {
      var my_help = defaults['help'].slice();
      my_help[loady.DESC_KEY] = 'Super cool load gen. Call 555-1212 for Help.';
      var my_opts = {
        help: loady_help
      };
      return _.extend(my_opts, defaults);
    };

If you define a ``cli`` property which is a function that returns
[optimist](https://github.com/substack/node-optimist) compatible configuration
in the following format:

    {
        key: [SHORTCUT, DESC, FUNC],
        ...
    }

Then for each key:

* ``alias`` will be called with your SHORTCUT and KEY
* ``describe`` will be called with your SHORTCUT and DESC
* if present in arguments, FUNC callback will be invoked with your the value