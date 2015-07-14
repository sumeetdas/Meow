/**
 * Created by sumedas on 10-Apr-15.
 */

var Promise     = require('bluebird'),
    fs          = Promise.promisifyAll(require('fs')),
    path        = require('path'),
    _           = require('lodash'),
    cache       = require('memory-cache'),
    moment      = require('moment'),
    chokidar    = require('chokidar'),
    CronJob     = require('cron').CronJob,
    exec        = Promise.promisifyAll(require('child_process')).execAsync,
    config      = require('./config').getConfig(),
    utils       = require('./utils'),
    log         = config.log;

// cron job to commit all changes made by the app
new CronJob(config.jobs.cron.cronTime, function (){
    if (config.jobs.cron.enable) {
        exec('git status')
            .then(function (pStatus) {
                return exec('git add .');
            })
            .then(function (pConsoleOutput) {
                return exec('git commit -m \"cron job commit @ ' + (new Date()) + '\"');
            })
    }
}, null, true, config.jobs.cron.timezone);

function startup () {
    return processBlogPosts();
}

// watch for the changes made by the app and then process the blogs
var watcher = chokidar.watch('_posts');

watcher
    .on('add', processBlogPosts)
    .on('change', processBlogPosts)
    .on('unlink', processBlogPosts);


function processAndCacheBlogPostFile (pFileName) {
    if (typeof pFileName !== 'string') {
        throw new Error ('fileName is not a string');
    }

    var path = '_posts/' + pFileName;

    return fs
        .readFileAsync(path, "utf-8")
        .then(function (data) {
            data = data || '';

            var metaData = utils.getMetaData (data), publishedDate;

            if (metaData['published-date']) {
                publishedDate = moment(metaData['published-date']).format('YYYY-MM-DD');
            }
            else {
                // assign the post today's date
                metaData['published-date'] = new Date();
                publishedDate = moment(metaData['published-date']).format('YYYY-MM-DD');

                // add 'published-data' info at the top of YAML metadata found in each blog post
                var tempData = data.split('\n');
                tempData = tempData
                    .slice(0,1)
                    .concat('published-date: ' + publishedDate)
                    .concat(tempData.slice(1));
                tempData = tempData.join('\n');

                // rewrite the content to the file
                fs.writeFileSync(path, tempData);
            }

            var tags       = cache.get('tags') || {},
                keywords   = cache.get('keywords') || {};

            // cache tags
            _.forEach(metaData.tags, function (pTag) {
                pTag = pTag.trim();
                tags[pTag] = tags[pTag] || [];
                tags[pTag] = _.union(tags[pTag], [pFileName.replace('.md', '')]);
            });
            cache.put('tags', tags);

            // cache keywords
            _.forEach(metaData.keywords, function (pKeyWord) {
                pKeyWord = pKeyWord.trim();
                keywords[pKeyWord] = keywords[pKeyWord] || [];
                keywords[pKeyWord] = _.union(keywords[pKeyWord], [pFileName.replace('.md', '')]);
            });
            cache.put('keywords', keywords);

            var posts = cache.get('posts') || {},
                postKey = publishedDate + '-' + utils.generateSlug(metaData.title);
            posts[postKey] = metaData;
            posts[postKey]['fileName'] = postKey;
            posts[postKey]['published-date'] = publishedDate;
            cache.put('posts', posts);

            var newFileName = '_posts/' + postKey + '.md';
            return fs.renameAsync(path, newFileName);
        })
        .catch(log.error);
}

function processBlogPosts () {
    // read '_posts' directory
    return fs
        .readdirAsync('_posts')
        .then(function (items) {
            items = items || [];
            return Promise.map(items, function (item) {
                // item = path.resolve('_posts', item);
                var itemPath = '_posts/' + item;
                processAndCacheBlogPostFile (item);
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