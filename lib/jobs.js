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
    ncp         = Promise.promisifyAll(require('ncp')).ncpAsync,
    exec        = Promise.promisifyAll(require('child_process')).execAsync,
    config      = require('./config').getConfig(),
    utils       = require('./utils'),
    MeowError   = require('./vo').MeowError,
    log         = config.log;

function startup () {
    return ncp(__dirname + '/html', utils.getFilePathRelativeToAppRoot('./public'), {clobber: false})
        .then(function () {
            return fs.statAsync('_posts');
        })
        .then(function (pStat) {
            if (!pStat.isDirectory()) {
                console.log("a file named _posts and without any extension? remove it!");
                return fs.unlinkAsync('_posts').then(function () { throw new Error(); });
            }
            else {
                return processBlogPosts().then(function () {
                    return publishSiteMaps().catch(log.error);
                });
            }
        })
        .catch(Error, function () {
            return fs.mkdirAsync('_posts').then(function () {
                return processBlogPosts().then(function () {
                    return publishSiteMaps().catch(log.error);
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
                return fs.writeFileAsync(path, tempData).catch(log.error);
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
            return fs.renameAsync(path, newFileName).catch(log.error);
        })
        .catch(log.error);
}

function processBlogPosts () {

    // deleting previous cache
    cache.put('posts', {});

    // read '_posts' directory
    return fs
        .readdirAsync('_posts')
        .then(function (pItems) {
            pItems = pItems || [];
            return Promise.map(pItems, function (pItem) {
                processAndCacheBlogPostFile (pItem);
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
            if (!pStat.isFile()) {
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
                    log.error(pErr);
                });
        });
}

/**
 * Creates a robots.txt file if it does not exists, then a sitemap.xml if it does not exist
 * and then creates (or overwrites existing) sitemap-posts.xml and sitemap-tags.xml
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
                    .catch(log.error);
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
                                return publishTagsSiteMap().catch(log.error);
                            });
                        })
                        .catch(log.error);
                })
                .catch(log.error);
        });
}

function publishPostsSiteMap() {
    var posts = cache.get('posts') || {};

    var postsPath = 'sitemap-posts.xml';

    function overwritePostsSiteMap () {
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
            .catch(log.error);
    }

    return fs
        .statAsync(postsPath)
        .then(function (pStat) {
            if (pStat.isFile()) {
                // delete the existing file
                return fs
                    .closeAsync(postsPath)
                    .then(function () {
                        return fs.unlinkAsync(postsPath).catch(log.error);
                    });
            }
        })
        .catch(function () {
            // write sitemap into this newly created file
            return fs
                .openAsync(postsPath, 'w')
                .then(function () {
                    return overwritePostsSiteMap();
                })
                .catch(log.error);
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
            .catch(log.error);
    }

    return fs
        .statAsync(tagsPath)
        .then(function (pStat) {
            if (pStat.isFile()) {
                // delete the existing file
                return fs
                    .closeAsync(tagsPath)
                    .then(function () {
                        return fs.unlinkAsync(tagsPath).catch(log.error);
                    });
            }
        })
        .catch(function () {
            // create a new file and write down the sitemap object in it
            return fs
                .openAsync(tagsPath, 'w')
                .then(function () {
                    return overwriteTagsSiteMap();
                })
                .catch(log.error);
        });
}

module.exports = {
    startup: startup,
    process: {
        posts: processBlogPosts,
        post: processAndCacheBlogPostFile
    }
};