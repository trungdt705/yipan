/**
 * Test IP matching mode, the ideal setting mode is
 *  A   10.64.45.*          Said to allow a machine room to take the test
 *  B   10.64.45.[1-100]    Indicates that IP is allowed to take 100 IP exams ranging from 10.64.415.1 to 10.64.45.100
 *  Prepare to form a character matching regular expression according to the user's settings, and then parse the specific ip value as needed
 *  Range matching
 *
 * Created by Administrator on 2016/12/29.
 */
var utils        = require('../libs/utils');
var pattern = '10.64.45.*';
console.log('pattern = ', pattern);
var pattern2 = utils.formatIpPattern(pattern);
console.log('regexp = ', pattern2.source);

var ips = [
    '::ffff:10.64.63.122'
    ,'::ffff:110.64.63.122'
    ,'::ffff:210.64.63.122'
    , '::ffff:10.64.63.11'
    , '::ffff:10.64.63.151'
    , '::ffff:1000.64.63.151'
    ,'10.64.45.1'
    ,'110.64.45.1'
    ,'210.64.45.1'
    ,'10.604.45.1'
    ,'10.64.45.-1'
    ,'10.64.45.2'
    ,'10.64.45.3'
    ,'10.64.45.102'
];

console.log('ip\tmatched');
for(var i in ips){
    console.log(ips[i], '\t', utils.parseIP(ips[i],new RegExp(pattern2, 'g')));
}
console.log('done');
