/*
 * Create and export configuration variable
 */

// Container for all the environments
let environments = {};

// Staging {default} environment
environments.staging = {
  'httpPort': 3000,
  'httpsPort': 3001,
  'envName': 'staging',
  'hashingSecret': 'thisIsASecret',
  'maxChecks': 5,
  'twilio': {
    'accountSid': 'AC5afade0cf3063d5a25fbc0ecd36d348b',
    'authToken': '0ba84cc5caf0df68d6c26b6ba030b48c',
    'fromPhone': '+12342306355'
  },
  'templateGlobals': {
    'appName': 'UptimeChecker',
    'companyName': 'Re-Mob.io',
    'yearCreated': '2018',
    'baseUrl': 'http://localhost:3000/'
  }
};

// Production environment
environments.production = {
  'httpPort': 5000,
  'httpsPort': 5001,
  'envName': 'production',
  'hashingSecret': 'thisIsAlsoASecret',
  'maxChecks': 5,
  'twilio': {
    'accountSid': '',
    'authToken': '',
    'fromPhone': ''
  },
  'templateGlobals': {
    'appName': 'UptimeChecker',
    'companyName': 'Re-Mob.io',
    'yearCreated': '2018',
    'baseUrl': 'http://localhost:5000/'
  }
};

// Determine which environment was passed as a command-line argument
let currentEnvironment = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : '';

// Check that the current environment is one of the environments above, if not , default to staging
let environmentToExport = typeof(environments[currentEnvironment]) == 'object' ? environments[currentEnvironment] : environments.staging;

// Export the module
module.exports = environmentToExport;