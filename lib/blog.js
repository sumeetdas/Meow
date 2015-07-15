/**
 * Created by sumedas on 03-Apr-15.
 */

var _          = require('lodash'),
    Promise    = require('bluebird'),
    fs         = Promise.promisifyAll(require('fs')),
    bodyParser = require('body-parser'),
    multer     = require('multer'),
    cache      = require('memory-cache'),
    utils      = require('./utils'),
    Post       = require('./vo').Post,
    config     = require('./config').getConfig(),
    log        = config.log;

function addBlog (pRequest, pResponse) {
    var post          = pRequest.body.post,
        metaData      = utils.getMetaData(post),
        publishedDate = metaData['published-date'],
        slug          = utils.generateSlug(metaData.title),
        path          = '_posts/' + publishedDate + '-' + slug + '.md';

    return fs
        .writeFileAsync(path, post)
        .then(function () {
            pResponse.send(200).end();
        });
}

function saveBlog (pRequest, pResponse) {
    var publishedDate = pRequest.params.year + '-' + pRequest.params.month + '-' + pRequest.params.date,
        path          = '_posts/' + publishedDate + '-' + pRequest.params.slug + '.md';

    return fs
        .writeFileAsync(path, pRequest.body.post)
        .then(function () {
            pResponse.status(200).end();
        });
}

function deleteBlog (pRequest, pResponse) {
    var publishedDate = pRequest.params.year + '-' + pRequest.params.month + '-' + pRequest.params.date,
        path          = '_posts/' + publishedDate + '-' + pRequest.params.slug + '.md';

    return fs
        .unlinkAsync(path)
        .then(function () {
            pResponse.send(200).end();
        })
        .catch(function (pErr) {
            pResponse.status(501).send(pErr).end();
        });
}

function getBlogs (pRequest, pResponse) {

    var posts = cache.get('posts') || {};

    pResponse.send(utils.sortPostsByPublishedDate(_.values(posts))).end();
}

function getBlogsByTag (pRequest, pResponse) {

    var tag    = pRequest.params.tag;

    var posts = cache.get('posts') || {};

    var postsWithGivenTag = [];

    _.forEach(posts, function (pPost) {
        if (!pPost || typeof pPost !== 'object' || !(pPost.tags instanceof Array))
        {
            return;
        }

        if (-1 !== _.indexOf(pPost.tags, tag))
        {
            postsWithGivenTag.push(pPost);
        }
    });

    pResponse.send(utils.sortPostsByPublishedDate(postsWithGivenTag)).end();
}

function uploadFile (pRequest, pResponse) {

    var uploadFileName = [pRequest.params.year, pRequest.params.month, pRequest.params.date,
                          pRequest.params.slug, pRequest.files.uploadFile.originalname].join('_');

    fs.rename(
        pRequest.files.uploadFile.path,
        __base + '_uploads/' + uploadFileName,
        function(error) {
            if(error) {
                pResponse.send(501).end();
            }

            pResponse.send(pRequest.files);
        }
    );
}

function getBlog (pRequest, pResponse) {

    var publishedDate = pRequest.params.year + '-' + pRequest.params.month + '-' + pRequest.params.date,
        postKey       = publishedDate + '-' + pRequest.params.slug,
        path          = '_posts/'; // + postKey + '.md'

    path = path + postKey + '.md';

    return fs
        .readFileAsync(path, 'utf-8')
        .then(function (data) {
            var blog = {};
            var post = cache.get('posts')[postKey];
            blog.title = post.title;
            blog.subtitle = post.subtitle;
            blog.post = data;
            blog.tags = post.tags;
            blog.fileName = post.fileName;
            pResponse.send(blog).end();
        })
        .catch(log.error);
}

function getMeta (pRequest, pResponse) {

    var meta = {
        blogsPerPage: config.blogsPerPage,
        username: config.username,
        disqus: config.disqus,
        angularSocialShare: config.angularSocialShare
    };
    pResponse.send(meta).end();
}

/**
 * This function finds blogs which matches given blog post title, tags and keywords with the query text
 * @param pRequest
 * @param pResponse
 */
function findBlogs (pRequest, pResponse) {

    var query       = pRequest.params.query,
        posts       = cache.get('posts') || {};

    var blogsToSend = [];

    for (var key in posts) {
        var post = new Post(posts[key]);
        if (post.containsQuery(query))
        {
            blogsToSend.push(posts[key]);
        }
    }
    pResponse.status(201).send(blogsToSend).end();
}

function redirectTo (pRequest, pResponse)
{
    pResponse.redirect('')
}

module.exports = function (pServer) {

    pServer.use(bodyParser.urlencoded({
        extended: true
    }));

    pServer.use(bodyParser.json());

    pServer.use(multer({
        dest: '_uploads/'
    }));

    pServer.use(
        (function () {
            var prerenderConfig = config.prerender;
            if (!!prerenderConfig.whitelist && !(prerenderConfig.whitelist instanceof Array))
            {
                throw new Error ("prerender.whitelist must be an array");
            }
            if (!!prerenderConfig.blacklist && !(prerenderConfig.blacklist instanceof Array))
            {
                throw new Error ("prerender.blacklist must be an array");
            }

            var prerenderMiddleware = require('prerender-node');

            for (var prop in prerenderConfig)
            {
                prerenderMiddleware.set(prop, prerenderConfig[prop]);
            }

            return prerenderMiddleware;
        })()
    );

    /**
      * non-categorized post routes
      */
    pServer.post('/api/blogs', addBlog);

    pServer.get('/api/blogs', getBlogs);

    pServer.get('/api/blogs/posts/:year/:month/:date/:slug', getBlog);

    pServer.put('/api/blogs/posts/:year/:month/:date/:slug', saveBlog);

    pServer.delete('/api/blogs/posts/:year/:month/:date/:slug', deleteBlog);

    pServer.get('/api/blogs/tags/:tag', getBlogsByTag);

    // search blogs by keywords
    pServer.get('/api/blogs/query/:query', findBlogs);

    // get blog meta route
    pServer.get('/api/meta', getMeta);

    /**
      * upload file routes
      */
    pServer.post('/api/blogs/upload/post/:year/:month/:date/:slug', uploadFile);

    /**
     * Mirroring angular-ui routes to avoid 404 in HTML5 mode
     */
    pServer.get('/blogs', function (pRequest, pResponse) {
        pResponse.redirect('/#/blogs');
    });

    pServer.get('/blogs/tags/:tag', function (pRequest, pResponse) {
        pResponse.redirect('/#/blogs/tags/' + pRequest.params.tag);
    });

    pServer.get('/blogs/query/:query', function (pRequest, pResponse) {
        pResponse.redirect('/#/blogs/query/' + pRequest.params.query);
    });

    pServer.get('/blogs/posts/:year/:month/:date/:slug', function (pRequest, pResponse) {
        pResponse.redirect('/#/blogs/posts/' + pRequest.params.year + '/' + pRequest.params.month + '/' + pRequest.params.date + '/' + pRequest.params.slug);
    });
};