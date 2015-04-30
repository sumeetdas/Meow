/**
 * Created by sumedas on 10-Apr-15.
 */

var Promise     = require('bluebird'),
    fs          = Promise.promisifyAll(require('fs')),
    _           = require('lodash'),
    cache       = require('memory-cache'),
    moment      = require('moment'),
    chokidar    = require('chokidar'),
    CronJob     = require('cron').CronJob,
    exec        = Promise.promisifyAll(require('child_process')).execAsync,
    config      = require('./config').getConfig(),
    utils       = require('./utils'),
    log         = config.log;

new CronJob(config.jobs.cron.cronTime, function (){
    if (config.jobs.cron.enable) {
        exec('git status')
            .then(function (status) {
                return exec('git add .');
            })
            .then(function (consoleOutput) {
                return exec('git commit -m \"cron job commit @ ' + (new Date()) + '\"');
            })
    }
}, null, true, config.jobs.cron.timezone);

/*console.log(config.jobs.cron.cronTime);
new CronJob(config.jobs.cron.cronTime, function (){
    console.log('Kolkata');
}, null, true, config.jobs.cron.timezone);*/

function startup () {
    return processBlogPosts();
}

var watcher = chokidar.watch('_posts');

watcher
    .on('add', processBlogPosts)
    .on('change', processBlogPosts)
    .on('unlink', processBlogPosts);


function processAndCacheBlogPostFile (fileName) {
    if (typeof fileName !== 'string') {
        throw new Error ('fileName is not a string');
    }

    return fs
        .readFileAsync('_posts/' + fileName, "utf-8")
        .then(function (data) {
            data = data || '';

            var metaData     = utils.getMetaData (data),
                publisedDate = moment(metaData['published-date']).format('YYYY-MM-DD');


            if (!metaData['published-date']) {
                metaData['published-date'] = new Date();
                var tempData = data.split('\n');
                tempData = tempData.slice(0,1).concat('published-date: ' + publisedDate).concat(tempData.slice(1));
                tempData = tempData.join('\n');
                fs.writeFileSync('_posts/' + fileName, tempData);
            }

            var tags = cache.get('tags') || {};
            _.forEach(metaData.tags, function (tag) {
                tag = tag.trim();
                tags[tag] = tags[tag] || [];
                tags[tag] = _.union(tags[tag], [fileName.replace('.md', '')]);
            });
            cache.put('tags', tags);

            var posts = cache.get('posts') || {}, postKey = fileName.replace('.md', '');
            posts[postKey] = metaData;
            posts[postKey]['fileName'] = postKey;
            posts[postKey]['published-date'] = publisedDate;
            cache.put('posts', posts);

            var newFileName = '_posts/' + publisedDate + '-' + utils.generateSlug(metaData.title) + '.md';

            return fs.renameAsync('_posts/'+fileName, newFileName)
        })
        .catch(log.error);
}

function processBlogPosts () {
    return fs
        .readdirAsync('_posts')
        .then(function (files) {
            files = files || [];
            var cachedPosts = cache.get('posts');
            cache.put('defaultOrder', _.keys(cachedPosts).sort(function (pFirst, pSecond) {
                pFirst = pFirst || '';
                pSecond = pSecond || '';
                var pFirstPublishedDate  = cachedPosts[pFirst]['published-date'],
                    pSecondPublishedDate = cachedPosts[pSecond]['published-date'];

                if (moment(pFirstPublishedDate).isAfter(pSecondPublishedDate)) {
                    return -1;
                }
                else if (moment(pFirstPublishedDate).isBefore(pSecondPublishedDate)) {
                    return 1;
                }
                else {
                    return pFirst.localeCompare(pSecond);
                }
            }));

            _.forEach(files, function (file) {
                processAndCacheBlogPostFile (file);
            });
        })
        .catch(log.error);
}

module.exports = {
    startup: startup,
    process: {
        posts: processBlogPosts,
        post: processAndCacheBlogPostFile
    }
};