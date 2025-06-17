const t = require('tap')

// The otplease function has been removed and its functionality
// is now handled by the registry client. OTP handling is tested
// through the registry client tests and command-level tests.
// Auth-specific functionality is tested through the adduser
// and login command tests.

t.test('auth module exports expected functions', async (t) => {
  const auth = require('../../../lib/utils/auth.js')

  t.type(auth.adduser, 'function', 'exports adduser function')
  t.type(auth.login, 'function', 'exports login function')
  t.notOk(auth.otplease, 'otplease is no longer exported')
})
