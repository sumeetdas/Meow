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
    jobs: {
        cron: {
            enable: true,
            cronTime: '00 30 11 * * *',
            timezone: 'Asia/Kolkata'
        }
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

    // https://github.com/expressjs/session#options
    session: {
        secret: '3$25136es.ge5936js7456',
        resave: true,
        saveUninitialized: true
    }
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