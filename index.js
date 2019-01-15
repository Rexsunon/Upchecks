/*
 * Primary file for the API
 */

// Dependencies
let server = require('./lib/server');
let workers =require('./lib/workers');

// Declare the app
let app = {};

// init function
app.init = function() {
  // start the sever
  server.init();
  
  // Strat the workers
  workers.init();
};

// Execute
app.init();