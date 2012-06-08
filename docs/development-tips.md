Developing Loady Activities
===========================

While writing activities, you'll often want to run them in a controlled fashion.

Use Node's `require.main` pattern to generate a user and whatever resources you'll
need for a single run.

    if (require.main === module) {
    ...
    }

Activities Template
-------------------

Putting it all together, here is a template for new activities:

    var userdb = require('userdb');
    exports.probability = 30 / 40;
    exports.startFunc = function (cfg, cb) {
      var user = userdb.getNewUser();
      // run through activity
    };
    if (require.main === module) {
      var debug = true;
      console.log('COmmand Line"');

      exports.startFunc({base: 'https://127.0.0.1'}, function (err) {
        if (err) {
          console.error(err);
        } else {
          console.log('Finished');
        }
      });
    }