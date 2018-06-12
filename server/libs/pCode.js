/**
 * Permission coding format
 * Created by yy on 2015/6/22.
 */
module.exports = (function () {
    var pCode = {};
    //Baseline character
    pCode.StandardCode = '0';
    //Authorization order definition table
    pCode.table = {
        'file': ['view', 'update', 'delete', 'create']
        , 'log': ['view', 'clear', 'delete']
        , 'user': ['view', 'update', 'delete', 'create']
        , 'role': ['view', 'update', 'delete', 'create']
    };

    //For ease of searching, the names of the views used for the collection are made up of an object whose value is equal to the index value in the table.
    pCode.frames = {};
    pCode.collectFrame = function () {
        var index = 0;
        for (var i in pCode.table) {
            pCode.frames[i] = index;
            index++;
        }
    };
    pCode.collectFrame();

    //Calculate the number of the specified view in the definition table, based on 0
    pCode.getFramePos = function (frame) {
        if (pCode.frames.hasOwnProperty(frame))
            return pCode.frames[frame];
        return -1;
    };

    //Collect index values ​​for the permissions of all views
    pCode.framePermit = {};
    pCode.collectFramePermit = function () {
        var index;
        var key;
        for (var frame in pCode.table) {
            index = 0;
            for (var permit in pCode.table[frame]) {
                key = frame + '_' + pCode.table[frame][permit];
                pCode.framePermit[key] = index;
                index++;
            }
        }
    };
    pCode.collectFramePermit();
    //Calculate the number of the given view's enactment authority, based on 0
    pCode.getPermitPos = function (frame, permit) {
        var key = frame + '_' + permit;
        if (pCode.framePermit.hasOwnProperty(key))
            return pCode.framePermit[key];
        return -1;
    };

    //Merge two permission characters
    pCode.mergeChar = function (c1, c2) {
        //First obtain the difference of the reference character, perform logical OR operation, and finally find the corresponding new permission character
        var stand = pCode.StandardCode.charCodeAt(0);
        var b1 = c1.charCodeAt(0) - stand;
        var b2 = c2.charCodeAt(0) - stand;
        b2 = b1 | b2;
        return String.fromCharCode(b2 + stand);
    };

    //Merge two permission strings
    pCode.mergePermit = function (p1, p2) {
        if (!p1) return p2;
        if (!p2) return p1;
        //Retain long permissions and make changes on it
        var l1 = p1.length;
        var l2 = p2.length;
        var result = '';
        if (l1 < l2) {
            //Check each character, form a logical OR result, and generate the permission character
            for (var i = 0; i < l1; i++) {
                result += pCode.mergeChar(p1.charAt(i), p2.charAt(i));
            }
            //The extra digits are copied directly
            result += p2.substr(l1);
        } else {
            for (var i = 0; i < l2; i++) {
                result += pCode.mergeChar(p1.charAt(i), p2.charAt(i));
            }
            if (l1 > l2)
                result += p1.substr(l2);
        }
        return result;
        console.log(result)
    };

    //Merge two path permissions
    //p3 = {supplier:{code:['yiyu']}, user:{name:['张三','李四']}};
    //p4 = {supplier:{code:['lhq'],name:['ywy']}, user:{code:['ftong'],name:['王武']}
    //    , log:{remark:['ddd']}};
    //pMerged2 = {supplier:{code:['yiyu','lhq'],name:['ywy']}
    //    , user:{code:['ftong'],name:['王武','张三','李四']}
    //    , log:{remark:['ddd']}};
    pCode.mergeProperty = function (p1, p2) {
        for (var i in p2) {
            if (!p1.hasOwnProperty(i))
                p1[i] = p2[i];
            else {
                for (var j in p2[i]) {
                    if (p1[i].indexOf(p2[i][j]) < 0)
                        p1[i].push(p2[i][j]);
                }
            }
        }
        return p1;
    };
    pCode.mergePath = function (p1, p2) {
        if (!p1) return p2;
        if (!p2) return p1;
        //Traverse all properties of the second path, if the first path exists, compare different expenses, if necessary, increase the property
        //If the first path does not exist, then increase on the first path
        for (var i in p2) {
            if (!p1.hasOwnProperty(i))
                p1[i] = p2[i];
            else {
                p1[i] = pCode.mergeProperty(p1[i], p2[i]);
            }
        }
        return p1;
    };

    return pCode;
})();
