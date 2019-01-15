/**
 * Worker-related tasks
 */

//  Dependencies
const path = require('path');
const fs = require('fs');
const _data = require('./data');
const https = require('https');
const http = require('http');
const helpers = require('./helpers');
const url = require('url');
const _logs = require('./logs');
const util = require('util');
const debug = util.debuglog('workers');

// Instantiate the worker object
let workers = {};

// Lookup all the checks, get their data, send to a validator
workers.gatherAllCheckes = () => {
  // Get all the checks
  _data.list('check', (err, checks) => {
    if (!err && checks && checks.length > 0) {
      // read in the check data
      _data.read('check', checks, (err, originalCheckData) => {
        if (!err && originalCheckData) {
          // Pass it to the check validator, and let the function continue or log errors as needed
          workers.validateCheckData(originalCheckData);
        } else {
          debug("Error reading one of the check's data");
        }
      });
    } else {
      debug("Error: Could not find any checks to process");
    }
  });
};

// Satity-check the cheak-data
workers.validateCheckData = originalCheckData => {
  originalCheckData = typeof(originalCheckData) == 'object' && originalCheckData != null ? originalCheckData : {};
  originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false;
  originalCheckData.userPhone = typeof (originalCheckData.userPhone) == 'string' && originalCheckData.userPhone.trim().length == 20 ? originalCheckData.userPhone.trim() : false;
  originalCheckData.protocol = typeof (originalCheckData.protocol) == 'string' && ['http', 'https'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false;
  originalCheckData.url = typeof (originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
  originalCheckData.method = typeof (originalCheckData.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method : false;
  originalCheckData.successCodes = typeof (originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false;
  originalCheckData.timeoutSeconds = typeof (originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds >= 1 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;

  // Set the keys that may not be set (if the workers have never seen this check before)
  originalCheckData.state = typeof (originalCheckData.state) == 'string' && ['up', 'down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
  originalCheckData.lastChecked = typeof (originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;

  // if all the checks pass pass the data along the the next step in the process
  if (originalCheckData.id &&
    originalCheckData.userPhone &&
    originalCheckData.protocol && 
    originalCheckData.url && 
    originalCheckData.method && 
    originalCheckData.successCodes && 
    originalCheckData.timeoutSeconds) {
      workers.performCkeck(originalCheckData);
    } else {
      debug("Error: one of the checks is not properly formatted. Skipping it.");
    }
};

// Perform the check, send the originalCheckdata and the outcome of the check processes
workers.performCkeck = originalCheckData => {
  // Prepare the initial check outcome
  let checkOutCome = {
    'error': false,
    'responseCode': false
  };

  // Marked that the outcome has not been sent yet
  let outcomeSent = false;

  // Parse the hostname and the path out of the originalCheckData
  let parseUrl = url.parse(originalCheckData.protocol+'://'+originalCheckData.url, true);
  let hostname = parseUrl.hostname;
  let path = parseUrl.path; // Using path and not "pathname" because we want the query string

  // Consturt the request
  let requestDetails = {
    'protocol': originalCheckData.protocol+':',
    'hostname': hostname,
    'method': originalCheckData.method.toUpperCase(),
    'path': path,
    'timeout': originalCheckData.timeoutSeconds * 1000
  };

  // Instantiate the request object (using the either the http or the https mpde)
  let _moduleToUse = originalCheckData.protocol == 'http' ? http : https;
  let req = _moduleToUse.request(requestDetails, (res) => {
    // Grab the status of the sent request
    let status = res.statusCode;

    // Update the checkOutCome and pass the data along
    checkOutCome.responseCode = status;
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  // Bind to the erroe event so it donen't get thrown
  req.on('error', e => {
    // Update the checkOutcome and pass the data along
    chackOutome.error = {
      'error': true,
      'value': e
    };
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  // Bind to the timeout event
  req.on('timeout', e => {
    // Update the checkOutcome and pass the data along
    chackOutcome.error = {
      'error': true,
      'value': 'timeout'
    };
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  // End the request
  req.end();
};

// Process the check outcome and update the check data as needed, trigger an alert to the user
// Special logic for accomodating a check that has never been tested before (don't alert on that one)

workers.processCheckOutcome = (originalCheckData, checkOutcome, callback) => {
  // Dicide if the check is concidered up or down
  let state  = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode > -1 ? 'up' : 'down');

  // Decide if an alert is warranted
  let alertWarranted = originalCheckData.lastChecked && originalCheckData.state != state ? true : false;
  
  // Log the outcome
  let timeOfCheck = Date.now();
  workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);

  // Update the check data
  let newCheckdata = originalCheckData;
  newCheckdata.state = state;
  newCheckdata.lastChecked = Date.now();

  // Save updates
  _data.update('checks', newCheckdata.id, newCheckdata, err => {
    if (!err) {
      // Send the new check data to the next phase in the process if needed
      if (alertWarranted) {
        workers.alertUserToStatusChange(newCheckdata);
      } else {
        debug("Check outcome has to chagned, no alert needed");
      }
    } else {
      debug("Error tring to save update to one of the checks");
    }
  });
};

// Alert the user as to a change in their check status
workers.alertUserToStatusChange = newCheckdata => {
  let msg = 'Alert: Your check for ' + newCheckdata.method.toUpperCase() +' ' + newCheckdata.protocol+'://' + newCheckdata.url + ' is currently ' + newCheckdata.state;
  helpers.setInterval(newCheckdata.userPhone, msg, err => {
    if (!err) {
      debug("Success: User was alerted to a status change in their check, via sms: ", msg);
    } else {
      debug("Error: Could not send sms alert to user who had a state change in the check");
    }
  });
};

workers.log = (originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck) => {
  // Form the log data
  let logData = {
    'check': originalCheckData,
    'outcome': checkOutcome,
    'state': state,
    'alert': alertWarranted,
    'time': timeOfCheck
  };

  // Convert data to a string
  let logString = JSON.stringify(logData);

  // Determine the name of the log file
  let logFile = originalCheckData.id;

  // Append the log string to the file
  _logs.append(logFile, logString, err => {
    if (!err) {
      debug("Logging to file succeeded");
    } else {
      debug("Logging to file failed");
    }
  });
};

// Timer to execute the worker-process once per minute
workers.loop = () => {
  setInterval(() => {
    workers.gatherAllCheckes();
  }, 1000 * 60);
};

// Rotate (compress) the log files
workers.rotateLogs = () => {
  // List all the (non compressed) log files
  _logs.list(false, (err, logs) => {
    if (!err && logs && logs.length > 0) {
      logs.forEach(logName => {
        // Compress the data to a different file
        let logId = logName.replace('.log', '');
        let newFileId = logId + '-' + Date.now();
        _logs.compress(logId, newFileId, err => {
          if (!err) {
            // Truncate the log
            _logs.truncate(logId, err => {
              if (!err) {
                debug("Success truncating log file");
              } else {
                debug("Error truncating log file");
              }
            });
          } else {
            debug("Erroe compressing one of the log files", err);
          }
        });
      });
    } else {
      debug("Error: could not find any logs to rotate");
    }
  });
};

// Timer to execte the log rotation process once per day
workers.logRotationLoop = () => {
  setInterval(() => {
    workers.rotateLogs();
  }, 1000 * 60 * 60 * 24);
};

// Init script
workers.init = () => {

  // Send to console in yellow
  console.log('\x1b[33m%s\x1b[0m','Background workers are running');

  // Execute all the checks immediately
  workers.gatherAllCheckes();

  // call the loop so that checks will execute later on
  workers.loop();

  // Compress all the logs immediately
  workers.rotateLogs();

  // Call the compress loop so logs will be compressed later on
  workers.logRotationLoop();
};



// Export the module
module.exports = workers;