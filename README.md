# Loady
## We'll have your services crying loady, loady, loady

## Status

**Note:** This code is very early and not ready for use.

Loady is a load testing framework. You provide a config file and a set of Node modules that simulate user activity. Loady will generate thousands of requests per second. You can estimate maximum capacity, stress test code, etc.

## Installation

    npm install loady

## Usage

    ./node_module/.bin/loady -c ./tests/load_gen.js

Example Loady Script ``load_gen.js``:

    exports.config = function () {
      return {
        app_name: 'Foobar 5000',
        activities_dir: './lib/load/activities'
      };
    };

## Loady Activities

Your load testing is accomplished through a series of Loady Activities. These are simply
Node modules with a ``startFunc`` function and a ``probability`` float.

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

## Listing Loady Activities

    $ ./node_module/.bin/loady -c ./tests/load_gen.js -l
    available activities: well_known, provision_no_session, auth, provision


## User Database

Loady uses an in-memory representation of users. If you wish to control user creation
than add an Activity named ``signup``.

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

## Adding options to loady CLI

You can override or extend the command line options for loady to give yourself hooks to your
own load testing activities:


    const _ = require('underscore'),
          loady = require('loady');

    exports.config = function () {
      return {
        app_name: 'Foobar 5000',
        activities_dir: './lib/load/activities'
      };
    };

    exports.cli = function (defaults) {
      var my_help = defaults['help'].slice();
      my_help[loady.DESC_KEY] = 'Super cool load generation. Call 555-1212 for Help.';
      var my_opts = {
        help: loady_help
      };
      return _.extend(my_opts, defaults);
    };

If you define a ``cli`` property which is a function that returns
[optimist](https://github.com/substack/node-optimist) compatible configuration if the following format:

    {
        key: [SHORTCUT, DESC, FUNC],
        ...
    }

Then for each key:

* ``alias`` will be called with your SHORTCUT and KEY
* ``describe`` will be called with your SHORTCUT and DESC
* if present in arguments, FUNC callback will be invoked with your the value