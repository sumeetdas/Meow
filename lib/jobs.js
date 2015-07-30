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
    sm          = require('sitemap'),
    CronJob     = require('cron').CronJob,
    exec        = Promise.promisifyAll(require('child_process')).execAsync,
    config      = require('./config').getConfig(),
    utils       = require('./utils'),
    MeowError   = require('./vo').MeowError,
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
    return fs
        .statAsync('_posts')
        .then(function (pStat) {
            if (!pStat.isDirectory()) {
                console.log("a file named _posts and without any extension? remove it!");
                return fs.unlinkAsync('_posts').then(function () { throw new Error(); });
            }
            else {
                return processBlogPosts()
                    .then(function () {
                        return publishSiteMaps();
                    })
                    .catch(config.log.error);
            }
        })
        .catch(Error, function (pErr) {
            return fs.mkdirAsync('_posts').then(function () {
                return processBlogPosts().then(function () {
                    return publishSiteMaps();
                });
            });
        });
}

// watch for the changes made by the app and then process the blogs
var watcher = chokidar.watch('_posts');

watcher
    .on('add', processBlogPosts)
    .on('change', processBlogPosts);


function processAndCacheBlogPostFile (pFileName) {
    if (typeof pFileName !== 'string') {
        throw new MeowError ('fileName is not a string');
    }

    var path = '_posts/' + pFileName;

    return fs
        .readFileAsync(path, "utf-8")
        .then(function (pData) {
            pData = pData || '';

            var metaData = utils.getMetaData (pData), publishedDate;

            if (metaData['published-date']) {
                if (metaData['published-date'] instanceof Date) {
                    publishedDate = moment(metaData['published-date'].toISOString()).format('YYYY-MM-DD');
                }
                else if (typeof metaData['published-date'] === 'string') {
                    publishedDate = metaData['published-date'];
                }
            }
            else {
                // assign the post today's date
                metaData['published-date'] = new Date();
                publishedDate = moment(metaData['published-date'].toISOString()).format('YYYY-MM-DD');

                // add 'published-data' info at the top of YAML metadata found in each blog post
                var tempData = pData.split('\n');
                tempData = tempData
                    .slice(0,1)
                    .concat('published-date: ' + publishedDate)
                    .concat(tempData.slice(1));
                tempData = tempData.join('\n');

                // rewrite the content to the file
                fs.writeFileSync(path, tempData);
            }

            var posts = cache.get('posts') || {},
                postKey = publishedDate + '-' + utils.generateSlug(metaData.title);
            posts[postKey] = metaData;
            posts[postKey]['title'] = metaData.title;
            posts[postKey]['fileName'] = postKey;
            posts[postKey]['published-date'] = publishedDate;
            posts[postKey]['tags'] = metaData.tags;
            posts[postKey]['keywords'] = metaData.keywords;
            cache.put('posts', posts);

            var newFileName = '_posts/' + postKey + '.md';
            return fs.renameAsync(path, newFileName);
        })
        .catch(log.error);
}

function processBlogPosts () {

    // deleting previous cache
    cache.put('posts', {});

    // read '_posts' directory
    return fs
        .readdirAsync('_posts')
        .then(function (items) {
            items = items || [];
            return Promise.map(items, function (item) {
                processAndCacheBlogPostFile (item);
            });
        })
        .catch(log.error);
}

/**
 * Creates a default robots.txt file if it does not exist
 * @returns {*}
 */
function publishRobotsTxt () {
    var path = 'robots.txt';
    return fs
        .statAsync(path)
        .then(function (pStat) {
            if (pStat.isFile()) {
                // file exists; do nothing
                return;
            }
            else {
                // go to our default course of action, that is create robots.txt file
                throw new Error ();
            }
        })
        .catch(Error, function () {
            return fs
                .openAsync(path, 'w')
                .then(function () {
                    return fs.writeFileAsync(path, 'User-agent: *\nSitemap: ' + config.siteUrl + '/sitemap.xml');
                })
                .catch(function (pErr) {
                    config.log.error(pErr);
                });
        });
}

/**
 * Creates a sitemap.xml if it does not exist and creates (or overwrites existing) sitemap-posts.xml and sitemap-tags.xml
 * @returns {*}
 */
function publishSiteMaps () {
    var path = 'sitemap.xml';

    return publishRobotsTxt ()
        .then(function () {
            return fs.statAsync(path);
        })
        .then(function (pStat) {
            if (pStat.isFile()) {
                // file exists; throw Error to proceed with creating of sitemaps for posts and tags
                return publishPostsSiteMap()
                    .then(function () {
                        return publishTagsSiteMap();
                    })
                    .catch(config.log.error);
            }
            else {
                // create sitemap.xml file
                throw new Error();
            }
        })
        .catch(function () {
            var sitemap = sm.createSitemap ({
                hostname: config.siteUrl,
                cacheTime: 600000,        // 600 sec - cache purge period
                urls: [{
                        url: '/sitemap-posts.xml',
                        changeFreq: 'weekly',
                        priority: 0.8,
                        lastmodrealtime: true
                    },
                    {
                        url: '/sitemap-tags.xml',
                        changeFreq: 'weekly',
                        priority: 0.8,
                        lastmodrealtime: true
                    }]
            });

            return fs
                .openAsync(path, 'w')
                .then(function () {
                    return fs
                        .writeFileAsync(path, sitemap.toString())
                        .then(function () {
                            // file exists; throw Error to proceed with creating of sitemaps for posts and tags
                            return publishPostsSiteMap().then(function () {
                                return publishTagsSiteMap();
                            });
                        })
                        .catch(config.log.error);
                })
                .catch(config.log.error);
        });
}

function publishPostsSiteMap() {
    var postsPath = 'sitemap-posts.xml';

    function overwritePostsSiteMap () {
        var posts = cache.get('posts') || {};

        var sitemap = sm.createSitemap ({
            hostname: config.siteUrl,
            cacheTime: 600000,        // 600 sec - cache purge period
            urls: (function () {
                var urls = [];
                _.forEach(posts, function (pPost) {
                    urls.push( {
                        url: '/' + pPost['published-date'].replace('-', '/') + '/' + utils.generateSlug(pPost['title']),
                        changeFreq: 'weekly',
                        priority: 0.8,
                        lastmodrealtime: true
                    } );
                });
                return urls;
            })()
        });

        return fs
            .writeFileAsync(postsPath, sitemap.toString())
            .catch(config.log.error);
    }

    return fs
        .statAsync(postsPath)
        .then(function (pStat) {
            if (!pStat.isFile()) {
                // create a sitemap and then throw MeowError to overwrite file
                return fs
                    .openAsync(postsPath, 'w')
                    .then(function () {
                        return overwritePostsSiteMap();
                    })
                    .catch(config.log.error);
            }
            else {
                // overwrite existing file
                return overwritePostsSiteMap().catch(config.log.error);
            }
        })
        .catch(function () {
            return fs
                .openAsync(postsPath, 'w')
                .then(function () {
                    return overwritePostsSiteMap();
                })
                .catch(config.log.error);
        });
}

function publishTagsSiteMap () {
    var posts = cache.get('posts') || {};

    var tagsPath = 'sitemap-tags.xml';

    function overwriteTagsSiteMap () {
        var posts = cache.get('posts') || {};

        var sitemap = sm.createSitemap ({
            hostname: config.siteUrl,
            cacheTime: 600000,        // 600 sec - cache purge period
            urls: (function () {
                var urls = [], tags = [];

                _.forEach(posts, function (pPost) {
                    _.forEach(pPost['tags'], function (pTag) {

                        if (!pTag || typeof pTag !== 'string' || pTag === '')
                        {
                            return;
                        }
                        tags.push(pTag);
                    });
                    tags = _.uniq(tags);
                });

                _.forEach(tags, function (pTag) {
                    urls.push( {
                        url: '/tags/' + pTag,
                        changeFreq: 'weekly',
                        priority: 0.8,
                        lastmodrealtime: true
                    } );
                });
                return urls;
            })()
        });

        return fs
            .writeFileAsync(tagsPath, sitemap.toString())
            .catch(config.log.error);
    }

    return fs
        .statAsync(tagsPath)
        .then(function (pStat) {
            if (!pStat.isFile()) {
                // create a sitemap and then throw MeowError to overwrite file
                return fs
                    .openAsync(tagsPath, 'w')
                    .then(function () {
                        return overwriteTagsSiteMap();
                    })
                    .catch(config.log.error);
            }
            else {
                // overwrite existing file
                return overwriteTagsSiteMap().catch(config.log.error);
            }
        })
        .catch(function () {
            return fs
                .openAsync(tagsPath, 'w')
                .then(function () {
                    return overwriteTagsSiteMap();
                })
                .catch(config.log.error);
        });
}

module.exports = {
    startup: startup,
    process: {
        posts: processBlogPosts,
        post: processAndCacheBlogPostFile
    }
};