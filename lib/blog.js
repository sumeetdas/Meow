/**
 * Created by sumedas on 03-Apr-15.
 */

var _          = require('lodash'),
    Promise    = require('bluebird'),
    fs         = Promise.promisifyAll(require('fs')),
    bodyParser = require('body-parser'),
    multer     = require('multer'),
    cache      = require('memory-cache'),
    exec       = Promise.promisifyAll(require('child_process')).execAsync,
    utils      = require('./utils'),
    Post       = require('./vo').Post,
    config     = require('./config').getConfig(),
    log        = config.log;

function addBlog (request, response) {
    var post          = request.body.post,
        metaData      = utils.getMetaData(post),
        publishedDate = metaData['published-date'],
        slug          = utils.generateSlug(metaData.title),
        path          = '_posts/' + publishedDate + '-' + slug + '.md';

    return fs
        .writeFileAsync(path, post)
        .then(function () {
            response.send(200).end();
        });
}

function saveBlog (request, response) {
    var publishedDate = request.params.year + '-' + request.params.month + '-' + request.params.date,
        path          = '_posts/' + publishedDate + '-' + request.params.slug + '.md';

    return fs
        .writeFileAsync(path, request.body.post)
        .then(function () {
            response.status(200).end();
        });
}

function deleteBlog (request, response) {
    var publishedDate = request.params.year + '-' + request.params.month + '-' + request.params.date,
        path          = '_posts/' + publishedDate + '-' + request.params.slug + '.md';

    return fs
        .unlinkAsync(path)
        .then(function () {
            response.send(200).end();
        })
        .catch(function (pErr) {
            response.status(501).send(pErr).end();
        });
}

function getBlogs (pRequest, pResponse) {

    var tagsObject = cache.get('tags') || {};

    var fileNameArray = [];

    // merge all the tags' file name arrays into one array
    _.forEach(_.values(tagsObject), function (pFileNameArray) {
        fileNameArray = _.union(fileNameArray, pFileNameArray);
    });

    utils
        .getCachedPostsData(fileNameArray)
        .then(function (pData) {
            pResponse.send(pData).end();
        })
        .error(function (pError) {
            log.error(pError);
            pResponse.status(501).send(pError).end();
        });
}

function getBlogsByTag (request, response) {

    var tag    = request.params.tag;

    var tags = cache.get('tags') || {};

    var postsWithGivenTag = tags[tag];

    if (! (postsWithGivenTag instanceof Array) ) {
        throw new Error ('postsWithGivenTag is not an array.');
    }

    return utils
        .getCachedPostsData(postsWithGivenTag)
        .then(function (data) {
            response.send(data).end();
        });
}

function uploadFile (request, response) {

    var uploadFileName = [request.params.year, request.params.month, request.params.date,
                          request.params.slug, request.files.uploadFile.originalname].join('_');

    fs.rename(
        request.files.uploadFile.path,
        __base + '_uploads/' + uploadFileName,
        function(error) {
            if(error) {
                response.send(501).end();
            }

            response.send(request.files);
        }
    );
}

function getBlog (request, response) {

    var publishedDate = request.params.year + '-' + request.params.month + '-' + request.params.date,
        postKey       = publishedDate + '-' + request.params.slug,
        path          = '_posts/'; // + postKey + '.md'

    path = path + postKey + '.md';

    return fs
        .readFileAsync(path, 'utf-8')
        .then(function (data) {
            var blog = {};
            var post = cache.get('posts')[postKey];
            blog.title = post.title;
            blog.post = data;
            blog.tags = post.tags;
            blog.fileName = post.fileName;
            response.send(blog).end();
        })
        .catch(log.error);
}

function getMeta (pRequest, pResponse) {

    var meta = {
        blogsPerPage: config.blogsPerPage,
        username: config.username,
        tags: Object.keys(cache.get('tags')) || [],
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

    pServer.get('/tags/:tag', function (pRequest, pResponse) {
        pResponse.redirect('/#//tags/' + pRequest.params.tag);
    });

    pServer.get('/query/:query', function (pRequest, pResponse) {
        pResponse.redirect('/#/query/' + pRequest.params.query);
    });

    pServer.get('/blogs/posts/:year/:month/:date/:slug', function (pRequest, pResponse) {
        pResponse.redirect('/#/blogs/posts/' + pRequest.params.year + '/' + pRequest.params.month + '/' + pRequest.params.date + '/' + pRequest.params.slug);
    });
};