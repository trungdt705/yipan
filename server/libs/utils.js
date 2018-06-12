/**
* Created by Administrator on 2015/7/10.
*/
var fs = require('fs');
module.exports = {
    /** Construct a uniform numbered string based on the specified type and number
     * For example: input @codeType = question, @no = 23
     * Output: Q0000023
     * Step: After initial capital + Add 7 digits and increase 0 + number
     * */
    generateCode : function (codeType, no) {
        var s = '' + no;
        while(s.length<7) s = '0' + s;
        var capital = codeType.charCodeAt(0);
        s = String.fromCharCode(capital-32) + s;
        return s;
    },

    //The first section determines whether there is a reverse proxy IP (header: x-forwarded-for), a remote IP that determines the connection, and an IP address of the backend socket
    getClientIP : function (req) {
        //console.log('req.headers = ',req.headers);
        //console.log('req.socket = ',req.socket);
        //console.log('req.connection = ',req.connection);
        //var reg = /(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])$/;
        var ip = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;
        return ip;
        //return ip.match(reg);
    }

    /** Parse IP string into 4 IP address bits */
    ,parseIP: function(ip, pattern){
        if(!ip)return null;
        var reg = /(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])$/g;
        if(pattern)
            reg = pattern;
        var matched = ip.match(reg);
        if(matched){
            //The first element is the matching IP address, divided into 4 characters with
            var items = matched[0].split('.');
            var numbers = [];
            for(var i in items) {
                //The first element of the first element may not be a number
                if(i=='0'){
                    var first = items[0].charAt(0);
                    if(first<='9' && first>='0')
                        numbers.push(Number(items[i]));
                    else
                        numbers.push(Number(items[i].substr(1)));
                }else
                    numbers.push(Number(items[i]));
            }
            return numbers;
        }else
            return null;
    }

    /** The user's given ip pattern string is converted into a regular expression matching template
     *  E.g   10.64.45.*
     * */
    , formatIpPattern : function(givenPattern){
        if(!givenPattern) return null;
        var pattern = givenPattern.replace(/\./g, '\\.');
        pattern = pattern.replace(/\*/g, '(\\d{1,2}|1\\d\\d|2[0-4]\\d|25[0-5])');
        return '(^|\\D)' + pattern + '$';
    }

    /** Is it an array */
    ,isArray: function (arr) {
        return typeof arr == "object" && arr.constructor == Array;
    }

    //The unique file name after the upload file is saved to the server
    ,generateNewName: function(fileFullName){
        //Rename <date + time> + original file name
        var d = new Date();
        return d.format('yyyyMMdd_hhmmssS') + '_' + fileFullName;
    }

    ,copyFile : function(src, target){
        var is = fs.createReadStream(src);
        var os = fs.createWriteStream(target);
        is.pipe(os);
    }
};