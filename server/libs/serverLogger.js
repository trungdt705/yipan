var pCode = require('./pCode');
var Log = require('../models/log');
var fs = require('fs');
var logOutput = "./logerror.txt";

/**
 * Server-side validation and logging functions
 */
module.exports.allowed = function (frame,permit, currentUser) {
    //Get the permission value corresponding to the current request
    if(pCode.table[frame] && currentUser){
        //Get the current user's permission string, need to determine two locations: the current view serial number and the current query permission number
        var framePos  = pCode.getFramePos(frame);
        var permitPos = pCode.getPermitPos(frame, permit);
        if(framePos<0 || permitPos<0) return false;
        //Extract the authorization character corresponding to the specified view
        var s = currentUser.permits.charCodeAt(framePos);
        s -= pCode.StandardCode.charCodeAt(0);
        var mask = 1 << (permitPos);
        return (mask & s);
    }
    return false;
};

/**
 * Registration log function
 * @param user          Operational user ID
 * @param path          path
 * @param method        method
 * @param parameters    parameter
 * @param url           Hyperlink
 * @returns {*}
 *
 * Write a log note:
 * 1.   Note some escaping methods, delete sometimes represents emptying, patch represents counting, and put sometimes represents pagination query
 * 2.   Deleting a single record requires constructing parameters yourself because the request did not provide
 * 3.   Need to construct url yourself when adding record
 */
module.exports.log = function (user,path,method,parameters,url) {
    var logger    = new Log();
    logger.user   = user;
    logger.method = method.toLowerCase();
    if(parameters)
        logger.parameters = JSON.stringify(parameters);

    /** Path format may be /users/ or /users/555555555
    //For ease of translation in the background, here is unified into the /users/ and /users/s modes.
    //And the latter can be used for tracking urls
    //There are 5 forms here:
    // form path  method => path method parameters url
    // Paging /users/ put  => /users/ get criteria null
    // Added /users/ post  => /users/s post body /users/:id
    // Inquire /users/:id get  => /users/s get body /users/:id
    // Updated /users/:id put  => /users/s put body /users/:id
    // delete /users/:id delete  => /users/s delete body null
    // task:  1. Can distinguish between the two forms of path, with var reg = /\/\w+\/\w+/;
    //        2. Add incoming incoming URLs
    //
    //Since there are many log queries and there is no significant meaning, the decision to not retain the query log, and increase the empty log, so support a total of 4 forms
        form path  method => path method parameters url
     // Empty /users/ delete   => /users/ delete null null
     // Added /users/ post     => /users/s post body /users/:id
     // Updated /users/:id put   => /users/s put body /users/:id
     // delete /users/:id delete  => /users/s delete body null
     */

    //First distinguish the path for two major categories
    var single = /\/\w+\/\w+/;
    var prefix = /\/\w+\//;

    if(path.match(single)){
        var matched = path.match(prefix)[0];
        logger.path = matched + 's';
        //Only delete no hyperlinks
        if(logger.method != 'delete'){
            logger.url = path;
        }
    }else{
        logger.path = path;
        //New operation requires setting hyperlinks and modifying path
        if(logger.method == 'post') {
            logger.url = url;
            logger.path += 's';
        }
    }

    //Save log to database
    logger.save(function (err) {
        if (err) {
            //Once an error is reported, it is output and saved to a text file
            var info = 'Error logging '+ err + ', arguments=' + arguments;
            console.log(info);
            fs.appendFile(logOutput, '\n' + info, function (err) {
                if (err) throw err;
            });
        }
    });
};