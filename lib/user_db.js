/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* the "user database".  a little in-memory collection of users for the
 * purposes of performance testing. */

const crypto = require('crypto'),
      request = require('request');

// the grandiose database
var users = [ ];

exports.num = function() { return users.length; };

function genEmail() {
  return exports.generate(16) + "@loadtest.domain";
}

// a little utilitiy function to get any one of an array of items
exports.any = function (a) {
  if (!Array.isArray(a)) throw "any may only be called on arrays";
  return a[Math.floor(Math.random() * a.length)];
};

exports.getNewUser = function(email, password) {
  // create and return a new user record
  var user = {
    // all users are "locked" upon creation to keep simultaneous
    // and conflicting activities from being performed on the
    // same user
    locked: true,
    // Provide a browser like object for load testing requests
    request: request.defaults({jar: request.jar()}),

    // TODO: Get rid of non-essential properties and make sure
    // A Script could inject these...

    // all users start with a single email address
    emails: [ email || genEmail() ],
    // a password of 10 chars
    password: password || exports.generate(10),
    // and four sites that they visit
    sites: [
      'http://' + exports.generate(8) + "." + exports.generate(3),
      'http://' + exports.generate(8) + "." + exports.generate(3),
      'http://' + exports.generate(8) + "." + exports.generate(3),
      'http://' + exports.generate(8) + "." + exports.generate(3)
    ],
    // and their device contexts (they have 2 devices on average)
    // key material is device specific
    ctxs: [
      {
        keys: {
        }
      },
      {
        keys: {
        }
      }
    ]
  };
  return user;
};

exports.clearCookies = function (user) {
  user.request = request.defaults({jar: request.jar()});
  return user;
};

exports.clearContexts = function(user) {
  user.ctxs = [ { keys: { } }, { keys: { } } ];
};

exports.addNewUser = function(user) {
  delete user.locked;
  users.push(user);
};

var numLockedUsers = 0;

exports.getExistingUser = function() {
  if (!users.length) throw "can't get an existing user. there aren't any.  call getNewUser first.";
  if (users.length === numLockedUsers) {
    console.log("all users are locked!");
    return undefined;
  }
  while (true) {
    var u = exports.any(users);
    if (!u.locked) {
      u.locked = true;
      numLockedUsers++;
      return u;
    }
  }
};

exports.splitUser = function(user) {
  if (!user.locked) throw "you can't split a user that's not in use!";
  if (user.emails.length == 1) {
    throw "you can't split a user with only one email";
  } else {
    // When splitting an account, always split off the *last* email.
    // The *first* email may be associated with a pre-created account.
    // see issue #681
    var newuser = exports.getNewUser(user.emails.pop());
    return newuser;
  }
};

exports.releaseUser = function(user) {
  if (!user.locked) throw "you can't release a user that's not in use!";
  delete user.locked;
  numLockedUsers--;
};

exports.addEmailToUser = function(user) {
  var email = genEmail();
  user.emails.push(email);
  return email;
};

exports.removeLastEmailFromUser = function(user) {
  user.emails.pop();
};

exports.addCertToUserCtx = function(ctx, email, cert) {
  ctx.keys[email].cert = cert;
};

// make this async capable
function bytesToChars(buf) {
  var str = "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  // yes, we are biasing the output here a bit.
  // I'm ok with that. We can improve this over time.
  for (var i=0; i < buf.length; i++) {
    str += alphabet.charAt(buf[i] % alphabet.length);
  }

  return str;
}

exports.generate = function(chars, cb) {
  if (cb) {
    crypto.randomBytes(chars, function(ex, buf) {
      cb(bytesToChars(buf));
    });
  } else {
    return bytesToChars(crypto.randomBytes(chars));
  }
};
