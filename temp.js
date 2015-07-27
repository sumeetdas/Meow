var Promise = require('bluebird'),
    MeowApiError = require('./lib/vo').MeowApiError,
    MeowError = require('./lib/vo').MeowError,
    fs = Promise.promisifyAll(require('fs'));


var path = '_posts/2015-06-27-new-post.md';

fs
    .statAsync(path)
    .then(function (pStat) {
        if (!pStat.isFile()) {
            // throw an error which you do not want to catch
            throw new MeowApiError("File does not exists.");
        }
        else {
            // we found our file, lets save the contents in it
            throw new MeowError ();
        }
    })
    .catch(MeowError, function () {
        return fs
            .writeFileAsync(path, 'good morning!')
            .then(function () {
                console.log('yay');
            })
            .catch(function () {
                throw new Error ("Unknown error");
            });
    })
    .catch(function (pErr) {
        if (pErr.code === 'ENOENT') {
            throw new MeowApiError("File does not exists.");
        }
        else {
            throw pErr;
        }
    });