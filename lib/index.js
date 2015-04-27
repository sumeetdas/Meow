/**
 * Created by sumedas on 18-Apr-15.
 */

var jobs   = require('./jobs'),
    config = require('./config'),
    blog   = require('./blog'),
    utils  = require('./utils');

var engine = {
    jobs: jobsFunc,
    config: configFunc,
    blog: blogFunc,
    utils: utils
};

function configFunc (pFunc) {
    pFunc (config);
    return engine;
}

function blogFunc (pApp) {
    blog (pApp);
    return engine;
}

function jobsFunc (pFunc) {
    pFunc (jobs);
    return engine;
}

module.exports = engine;