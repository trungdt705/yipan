/**
 * Basic configuration file, here is equivalent to a set of key values, any one through require(<this js file>)
 * Statement will get all key-value information defined here
 */

module.exports = {
    'port': process.env.PORT || 28081
    ,'database': 'mongodb://admin:myl@127.0.0.1:27017/yipan'
    ,'secret': 'ArbeitMachtFreiSonstNichts'
    ,'uploadRemoveReplaced': true           //Whether to delete files that are overwritten and deleted, because the file names are unique, these files can be completely preserved
    ,'uploadDir': __dirname + '/public/uploads/'
    ,'exportDir': __dirname + '/public/exports/'
    ,'logDir': __dirname + '/logs/'
};