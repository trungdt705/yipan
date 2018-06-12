/**
 * Created by Administrator on 2016/3/23.
 */
//Ordinary asynchronous execution method
var accounts = ['Checking Account', 'Travel Rewards Card', 'Big Box Retail Card'];
console.log('Updating balance information...');
accounts.forEach(function (account) {
    console.log(account + ' Balance: ');

});

//Asynchronous with Promise
var requests = accounts.map(function (account) {
    console.log(account + ' Balance: ');
    Promise.resolve();
});
// Update status message once all requests are fulfilled
Promise.all(requests).then(function (balances) {
    console.log('All ' + balances.length + ' balances are up to date');
}).catch(function (error) {
    console.log('An error occurred while retrieving balance information');
    console.log(error);
});

//Random number generation mechanism under test
//Randomly fetch several numbers from an array of a specified length
var getRandomIndex = function(total, toSelect){
    //First prepare a plastic array of a specified length
    var all = [];
    for(var i=0; i<total; i++)
        all.push(i);

    //Continuously several times
    var selected = [];
    for(var i=0; i<toSelect; i++) {
        //Get an index randomly based on the existing length
        var index = Math.floor((Math.random() * all.length));
        //Insert the corresponding element of the index into the target collection
        selected.push(all[index]);
        //Remove it from the candidate set
        all.splice(index,1);
    }
    return selected;
};

console.log(getRandomIndex(12,5));
console.log(getRandomIndex(5,5));
console.log(getRandomIndex(34,2));
console.log(getRandomIndex(34,2));
console.log(getRandomIndex(34,2));
console.log(getRandomIndex(34,2));
console.log(getRandomIndex(34,2));