"use strict";
/**
 * Background server entry function, start the service through node server
 * @type {*|exports}
 */

//Load various service types
var express           = require('express');		// call express
var app               = express(); 				// define our app using express
var bodyParser        = require('body-parser'); 	// get body-parser
var morgan            = require('morgan'); 		// used to see requests
var mongoose          = require('mongoose');       // communication with mongodb
var config            = require('./config');       // read configurations
var path              = require('path');           // get support of local file system
var FileStreamRotator = require('file-stream-rotator');
var fs                = require('fs');
var logDirectory      = config.logDir;
var exportDirectory   = config.exportDir;
var uploadDirectory   = config.uploadDir;

// ensure directory exists
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);
fs.existsSync(exportDirectory) || fs.mkdirSync(exportDirectory);
fs.existsSync(uploadDirectory) || fs.mkdirSync(uploadDirectory);

// create a rotating write stream
var accessLogStream = FileStreamRotator.getStream({
    filename: logDirectory + '/access-%DATE%.log'
    , frequency: 'daily'
    , verbose: false
    , date_format: "YYYY-MM-DD"
});

// Date extension, convert Date to a String of the specified format
// Month (M), day (d), hour (h), minute (m), second (s), quarter (q) can use 1-2 placeholders,
// Years (y) can use 1-4 placeholders, milliseconds (S) can only use 1 placeholder (1-3 digits)
// example:
// (new Date()).Format("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423
// (new Date()).Format("yyyy-M-d h:m:s.S")      ==> 2006-7-2 8:9:4.18
Date.prototype.format = function (fmt) { //author: meizz
    var o = {
        "M+": this.getMonth() + 1, //month
        "d+": this.getDate(), //day
        "h+": this.getHours(), //hour
        "m+": this.getMinutes(), //Minute
        "s+": this.getSeconds(), //second
        "q+": Math.floor((this.getMonth() + 3) / 3), //Quarterly
        "S": this.getMilliseconds() //millisecond
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}

/**
 * The current application uses the JSON encoding of the URL to uniformly transfer the format of the information so that all information can be read and written in the json format.
 */
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

/**
 * Add a response message to all requests in the current application
 */
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, Authorization');
    next();
});

/**
 * Use the morgan framework to output all requests to the console
 */
var logger = morgan('combined', {
    stream: accessLogStream
    ,skip: function(req, res) { return res.statusCode < 400}
});
app.use(logger);
//app.use(morgan('dev'));

/**
 * Connect to the database
 */
mongoose.connect(config.database, {useMongoClient:true});
mongoose.Promise = global.Promise;
/**
 * Set static code directory location, that is, all files in this directory are visible
 */
app.use('/public', express.static(__dirname + '/public'));

/**
 * Read server-defined routing rules
 * @type {apiRouter|exports}
 */
var apiRoutes = require('./server/api')(app, express);
app.use('/api', apiRoutes);

/**
 * Set all paths to index.html,
 */
app.get('*', function (req, res) {
    res.sendFile(path.join(__dirname + '/public/app/index.html'));
});

/**
 * Start the server and listen for requests from the front end
 */
app.listen(config.port);
console.log('Magic happens on port hehe' + config.port);