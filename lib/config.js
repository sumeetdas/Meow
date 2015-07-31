/**
 * Created by sumedas on 14-Apr-15.
 */

var _       = require('lodash'),
    utils   = require('./utils');

var config = {
    log: {
        info: console.log,
        error: console.error
    },
    blogsPerPage: 5,
    username: 'John Doe',
    disqus: {
        shortname: ''
    },
    angularSocialShare: {
        facebook: {
            appId: ''
        },
        twitter: {
            handle: ''
        }
    },

    // prerender-node settings
    prerender: {
    },

    // file path is relative to project's root directory
    editPageName: './public/edit.html',

    // file path relative to project's root directory where blogs will be viewed
    indexPageName: './public/index.html',

    // https://github.com/expressjs/session#options
    session: {
        secret: '3$25136es.ge5936js7456',
        resave: true,
        saveUninitialized: true
    },

    // url of your site, e.g. http://www.example.com. This format must be adhered to.
    siteUrl: 'http://www.example.com'
};

function getConfig () {
    return config;
}

function setConfig (pName, pConfig) {
    if (typeof pName !== 'string') {
        throw new Error ('pName is not a string');
    }

    pConfig = pConfig || {};

    if (pName === '') {
        config = _.extend(config, pConfig);
    }
    else {
        utils.setPropertyVal(config, pName, pConfig);
    }

    return this;
}

module.exports = {
    getConfig: getConfig,
    setConfig: setConfig
};