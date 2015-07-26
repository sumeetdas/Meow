/**
 * Created by sumedas on 10-Apr-15.
 */
var Promise   = require('bluebird'),
    cache     = require('memory-cache'),
    _         = require('lodash'),
    moment    = require('moment'),
    yaml      = require('yamljs'),
    MeowError = require('./vo').MeowError;

/**
 * Utility method to set property value of an object by using the dot notation of the affected property
 *
 * For instance, for the following object:
 * var someObject =
 * {
 *  animals: {
 *      cow: true,
 *      cat: false
 *  }
 * };
 *
 * If we want to change the property val of 'cat', we can use this function to do so:
 * 
 * setPropertyVal (someObject, 'animals.cat', true);
 *
 * @param pObj Object whose property value needs to be updated
 * @param pProp dot notation property value, e.g. 'animal.cat'
 * @param pNewVal new value with which the property @param pProp will be updated with
 */
function setPropertyVal (pObj, pProp, pNewVal) {
    if (typeof pProp === 'string') {
        pProp = pProp || '';
        pProp = pProp.split('.');
    }

    if (pProp.length > 1) {

        var prop    = pProp.shift();

        pObj[prop]  = (typeof pObj[prop] !== 'undefined'
                       || typeof pObj[prop] !== 'null') ? pObj[prop] : {};

        setPropertyVal(pObj[prop], pProp, pNewVal);

    } else {
        pObj[ pProp[0] ] = pNewVal;
    }
}

/**
 * Retrieves metadata for a given meow format blog post. This metadata will further be cached into 'posts'.
 * @param data The meow format blog post; must be a string
 * @returns {Object}
 * Typical format would be :
 * {
 *  title: (title)
 *  published-date: (published-date)
 *  tags: [tagArray]
 * }
 */
function getMetaData (data) {
    if (typeof data !== 'string') {
        throw new MeowError ('data is not a string');
    }
    data = data || '';
    data = data.split('\n');

    if (('' + data[0]).trim() !== '<!--') {
        throw new MeowError ("Incorrect format : Missing '<!--' in the beginning of the file");
    }

    var index = 1, metaData = [], dataLen = data.length;

    while (index < dataLen  && ('' + data[index]).trim() !== '-->' ) {
        metaData.push(data[index]);
        index++;
    }

    if (index == dataLen) {
        throw new MeowError ("Incorrect format : Missing closing '-->' for metadata comment");
    }

    metaData = metaData.join('\n');
    metaData = yaml.parse(metaData);

    if (!metaData.tags || typeof metaData.tags !== 'string')
    {
        metaData.tags = '';
    }
    metaData.tags = metaData.tags.split(',');
    metaData.tags = _.map(metaData.tags, function (tag) { return tag.trim(); });

    if (!metaData.keywords || typeof metaData.keywords !== 'string')
    {
        metaData.keywords = '';
    }
    metaData.keywords = metaData.keywords.split(',');
    metaData.keywords = _.map(metaData.keywords, function (tag) { return tag.trim(); });

    return metaData;
}

/**
 * Generates slug for a given title
 * @param title
 * @returns {string} slug generated for @param title
 */
function generateSlug (title) {
    if (typeof title !== 'string') {
        throw new MeowError ('title is not a string');
    }
    title = title || '';
    title = title.toLocaleLowerCase().replace(/[\W]/g, '-').replace(/[\-]{2,}/g, '-');
    return title;
}

/**
 * This function will order the posts array according to its published date in descending order
 * @param pPosts object containing cached posts data filed under some category
 */
function sortPostsByPublishedDate (pPosts) {
    if (! (pPosts instanceof Array) ) {
        throw new MeowError ("pPosts is not an array");
    }

    pPosts.sort(function (pFirst, pSecond) {
        pFirst = pFirst || {};
        pSecond = pSecond || {};
        var pFirstPublishedDate  = pFirst['published-date'],
            pSecondPublishedDate = pSecond['published-date'];

        if (moment(pFirstPublishedDate).isAfter(pSecondPublishedDate)) {
            return -1;
        }
        else if (moment(pFirstPublishedDate).isBefore(pSecondPublishedDate)) {
            return 1;
        }
        else {
            return pFirst.title.localeCompare(pSecond.title);
        }
    });
    return pPosts;
}

module.exports = {
    getMetaData: getMetaData,
    generateSlug: generateSlug,
    //getCachedPostsData: getCachedPostsData,
    sortPostsByPublishedDate: sortPostsByPublishedDate,
    setPropertyVal: setPropertyVal
};
