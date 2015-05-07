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

var watcher = chokidar.watch('_posts');

watcher
    .on('add', processBlogPosts)
    .on('change', processBlogPosts)
    .on('unlink', processBlogPosts);


function processAndCacheBlogPostFile (pCategoryName, pFileName) {
    if (typeof pFileName !== 'string') {
        throw new Error ('fileName is not a string');
    }

    var path = '_posts/' + (pCategoryName ? pCategoryName + '/' : '') + pFileName;

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

            var categories = cache.get('categories') || {}, tags = {};

            if (!pCategoryName) {
                tags = categories[config.defaultCategoryAlias] || tags;
            }
            else {
                tags = categories[pCategoryName] || tags;
            }
            _.forEach(metaData.tags, function (tag) {
                tag = tag.trim();
                tags[tag] = tags[tag] || [];
                tags[tag] = _.union(tags[tag], [pFileName.replace('.md', '')]);
            });
            categories[config.defaultCategoryAlias] = tags;
            cache.put('categories', categories);

            var posts = cache.get('posts') || {},
                postKey = (pCategoryName ? pCategoryName + '-' : '') + publishedDate + '-' + utils.generateSlug(metaData.title),
                category = (pCategoryName ? pCategoryName  : config.defaultCategoryAlias);
            posts[category][postKey] = metaData;
            posts[category][postKey]['fileName'] = postKey;
            posts[category][postKey]['published-date'] = publishedDate;
            cache.put('posts', posts);

            var newFileName = '_posts/' + (pCategoryName ? pCategoryName + '/' : '') + postKey + '.md';
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
                return fs
                    .statAsync(itemPath)
                    .then(function (pStat) {
                        if (pStat && pStat.isDirectory()) {
                            // by convention, directory name is a category name too
                            var category = item;
                            return fs
                                .readdirAsync(item)
                                .then(function (pFiles) {
                                    pFiles = pFiles || [];
                                    return Promise.map(pFiles, function (pFile) {
                                        // by convention, 'pFile' is a file
                                        processAndCacheBlogPostFile (category, pFile);
                                    });
                                })
                                .catch(log.error);
                        }
                        else {
                            processAndCacheBlogPostFile (null, item);
                        }
                    });
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