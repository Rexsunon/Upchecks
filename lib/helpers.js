/*
 * Helpers for various files
 */

// dependecies
let crypto = require('crypto');
let config = require('./config');
let https = require('https');
let querystring = require('querystring');
let path = require('path');
let fs = require('fs');

// container for all helpers
let helpers = {};

// create a SHA256 hash
helpers.hash = (str) => {
  if(typeof(str) == 'string' && str.length > 0) {
    let hash = crypto.createHash('sha256',config.hashingSecret).update(str).digest('hex');
    return hash;
  } else {
    return false;
  }
};

// Parse a json string to an object in all caes without throwing
helpers.ParseJsonToObject = (str) => {
  try {
    let obj = JSON.parse(str);
    return obj;
  } catch (error) {
    return {};
  }
}

// Create a string of alphnumeric characters of a given length
helpers.createRandomString = (stringLength) => {
  stringLength = typeof(stringLength) == 'number' && stringLength > 0 ?stringLength : false;

  if (stringLength) {
    // Define all the possible characters that can go into a string
    let possibleCharacters = 'abcdefghtikmnopqrstuvwxyz0123456789';

    // strat the final string
    let str = '';
    for (i = 1; i <= stringLength; i++) {
      // Get the characters of the possibleCharacters string
      let randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
      // Then append this charaters to the final string
      str += randomCharacter;
    }
    // return the final string
    return str;
  } else {
    return false;
  }
};

// Send an SMS message via Twillio
helpers.sendTwilioSms = (phone, msg, callback) => {
  // validate the parameters
  phone = typeof(phone) == 'string' && phone.trim().length == 11 ? phone.trim() : false;
  msg = typeof(msg) == 'string' && msg.trim().length > 0 && msg.trim().length <= 1600 ? msg.trim() : false;
  if (phone && msg) {
    // Cofigure the request the request payload
    let payload = {
      'From': config.twilio.fromPhone,
      'To': '+234'+phone,
      'Body': msg
    };

    // Stringify the payload
    let stringPayoad = querystring.stringify(payload);

    // Configure the request details
    let requestDetails = {
      'protocol': 'https:',
      'hostname': 'api.twilio.com',
      'method': 'POST',
      'path': '/2010-04-01/Accounts/'+config.twilio.accountSid+'/Messages.json',
      'auth': config.twilio.accountSid+':'+config.twilio.authToken,
      'headers': {
        'Content-Type': 'application/x-www-from-urlencoded',
        'Content-Length': Buffer.byteLength(stringPayoad)
      }
    };

    // Instantiate the request object
    let req = https.request(requestDetails, res => {
      // Grab the status of the sent request
      let status = res.statusCode;
      // Callback successfully if the request sent through
      if (status == 200 || status == 201) {
        callback(false);
      } else {
        callback('Status code returned was ' + status);
      }
    });

    // Bind to the error event so it doesn't get thrown
    req.on('error', e => {
      callback(e);
    });

    // Add the payload
    req.write(stringPayoad);

    // End the request
    req.end();
  } else {
    callback('Given parameters were missing or invalid');
  }
};

// Get the string content of a template
helpers.getTemplate = (templateName,data,callback) => {
  templateName = typeof(templateName) == 'string' && templateName.length > 0 ? templateName : false;
  data = typeof (data) == 'object' && data !== null ? data : {};
  if (templateName) {
    let templatesDir = path.join(__dirname,'/../templates/');
    fs.readFile(templatesDir+templateName+'.html','utf8',(err,str) => {
      if (!err && str && str.length > 0) {
        // Do interpolation on the string
        let finalString = helpers.interpolate(str,data);
        callback(false,finalString);
      } else {
        callback('No template could be found');
      }
    });
  } else {
    callback('A valid template name was not specified');
  }
};

// Add the univeral header and footer to the string, and pass provided data object to the header and footer for interpolation
helpers.addUniversalTemplates = (str,data,callback) => {
  templateName = typeof (templateName) == 'string' && templateName.length > 0 ? templateName : false;
  data = typeof (data) == 'object' && data !== null ? data : {};
  // Get the header
  helpers.getTemplate('_header',data,(err,headerString) => {
    if (!err && headerString) {
      // Get the footer
      helpers.getTemplate('_footer',data,(err,footerString) => {
        if (!err && footerString) {
          // Add them all together
          let fullString = headerString+str+footerString;
          callback(false,fullString);
        } else {
          callback('Could not find the footer template');
        }
      });
    } else {
      callback('Could not find the header template');
    }
  });
};

// Take a given string and data object and find/replace all the krys within it
helpers.interpolate = (str,data) => {
  str = typeof(str) == 'string' && str.length > 0 ? str : '';
  data = typeof(data) == 'object' && data !== null ? data : {};

  // Add the templateGlobals to the data object, prepending their key name with "global"
  for(let keyName in config.templateGlobals) {
    if (config.templateGlobals.hasOwnProperty(keyName)) {
      data['global.'+keyName] = config.templateGlobals[keyName];
    }
  }

  // For each key in the data object, insert its value to the string at the data corresponding placeholder
  for (let key in data) {
    if (data.hasOwnProperty(key) && typeof(data[key]) == 'string') {
      let replace = data[key];
      let find = '{'+key+'}';
      str = str.replace(find,replace);
    }
  }
  return str;
};

// Get the content of a ststic (public) asset
helpers.getStaticAsset = (filename,callback) => {
  filename = typeof(filename) == 'string' && filename.length > 0 ? filename : false;
  if (filename) {
    let publicDir = path.join(__dirname,'/../public/');
    fs.readFile(publicDir+filename,(err,data) => {
      if (!err && data) {
        callback(false,data);
      } else {
        callback('No file could be found');
      }
    });
  } else {
    callback('A valid filename was not specifiled');
  }
};

// Export the module
module.exports = helpers;