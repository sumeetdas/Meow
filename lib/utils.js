/**
 * Created by sumedas on 10-Apr-15.
 */
var Promise   = require('bluebird'),
    cache     = require('memory-cache'),
    _         = require('lodash'),
    yaml      = require('yamljs');

function setPropertyVal (pObj, pProp, pVal) {
    if (typeof pProp === 'string') {
        pProp = pProp.split('.');
    }

    if (pProp.length > 1) {

        var prop    = pProp.shift();

        pObj[prop]  = (typeof pObj[prop] !== 'undefined'
                       || typeof pObj[prop] !== 'null') ? pObj[prop] : {};

        setPropertyVal(pObj[prop], pProp, pVal);

    } else {
        pObj[ pProp[0] ] = pVal;
    }
}

function getMetaData (data) {
    if (typeof data !== 'string') {
        throw new Error ('data is not a string');
    }
    data = data || '';
    data = data.split('\n');

    if (('' + data[0]).trim() !== '<!--') {
        throw new Error ("Incorrect format : Missing '<!--' in the beginning of the file");
    }

    var index = 1, metaData = [], dataLen = data.length;

    while (index < dataLen  && ('' + data[index]).trim() !== '-->' ) {
        metaData.push(data[index]);
        index++;
    }

    if (index == dataLen) {
        throw new Error ("Incorrect format : Missing closing '-->' for metadata comment");
    }

    metaData = metaData.join('\n');
    metaData = yaml.parse(metaData);
    metaData.tags = metaData.tags.split(',');
    metaData.tags = _.map(metaData.tags, function (tag) { return tag.trim(); });

    return metaData;
}

function generateSlug (title) {
    if (typeof title !== 'string') {
        throw new Error ('title is not a string');
    }
    title = title || '';
    title = title.toLocaleLowerCase().replace(/[\W]/g, '-').replace(/[\-]{2,}/g, '-');
    return title;
}

function getCachedPostsData (fileNames) {
    if ( ! (fileNames instanceof Array) ) {
        throw new Error ("fileNames is not an array");
    }

    return new Promise(function (resolve) {
        var postsCache = cache.get('posts');

        var dataToSend = [];
        _.forEach(fileNames, function (fileName) {
            dataToSend.push(postsCache[fileName]);
        });

        resolve(dataToSend);
    });
}

module.exports = {
    getMetaData: getMetaData,
    generateSlug: generateSlug,
    getCachedPostsData: getCachedPostsData,
    setPropertyVal: setPropertyVal
};
