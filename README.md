# Loady
## We'll have your services crying loady, loady, loady

## Status

**Note:** This code is very early and not ready for use.

Loady is a load testing framework. You provide a config file and a set of Node modules that simulate user activity. Loady will generate thousands of requests per second. You can estimate maximum capacity, stress test code, etc.

## Installation

    npm install loady

## Usage

    ./node_module/.bin/loady -c ./tests/load_gen.js

Example ``load_gen.js`` file:

    exports.config = function () {
      return {
        app_name: 'Foobar 5000',
        activities_dir: './lib/load/activities'
      };
    };

## Adding options to loady CLI

You can override or extend the command line options for loady.


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