/**
 * Commonly used tool functions
* Created by Administrator on 2015/7/10.
*/

var fs = require('fs');
var path = require('path');
module.exports = {
    /** Asynchronously fetching functions */
    readDir : function(dir, done) {
        var results = [];
        var len = dir.length;
        fs.readdir(dir, function(err, list) {
            if (err) return done(err);
            var pending = list.length;
            if (!pending) return done(null, results);
            list.forEach(function(file) {
                //Get absolute path
                file = path.resolve(dir, file);
                fs.stat(file, function(err, stat) {
                    if (stat && stat.isDirectory()) {
                        results.push({isFile:false,name:file.substr(len),size:stat.size,modified:stat.mtime});
                        if (!--pending) done(null, results);
                    } else {
                        results.push({isFile:true,name:file.substr(len),size:stat.size,modified:stat.mtime});
                        if (!--pending) done(null, results);
                    }
                });
            });
        });
    }
};