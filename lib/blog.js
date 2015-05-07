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
        category      = request.params.category,
        path          = '_posts/' + (category ? category + '/' : '') + publishedDate + '-' + request.params.slug + '.md';

    return fs
        .writeFileAsync(path, request.body.post)
        .then(function () {
            response.status(200).end();
        });
}

function deleteBlog (request, response) {
    var publishedDate = request.params.year + '-' + request.params.month + '-' + request.params.date,
        category      = request.params.category,
        path          = '_posts/' + (category ? category + '/' : '') + publishedDate + '-' + request.params.slug + '.md';

    return fs
        .unlinkAsync(path)
        .then(function () {
            response.send(200).end();
        })
        .catch(function (pErr) {
            response.status(501).send(pErr).end();
        });
}

function getBlogs (request, response) {

    var category = request.params.category || config.defaultCategoryAlias;

    var fileNames = cache.get('categories')[category] || [];

    utils
        .getCachedPostsData(fileNames)
        .then(function (data) {
            response.send(data).end();
        })
        .error(function (error) {
            log.error(error);
            response.sendStatus(501).end();
        });
}

function getBlogsByTag (request, response) {

    var tag    = request.params.tag;

    var categories = cache.get('categories') || {};

    var category = request.params.category || config.defaultCategoryAlias;

    var tags = categories[category] || [];

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
    var categoryName = request.params.category || config.defaultCategoryAlias;

    var uploadFileName = [categoryName, request.params.year, request.params.month, request.params.date,
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
    var publishedDate = request.params.year       + '-' + request.params.month + '-' + request.params.date,
        postKey       = publishedDate + '-' + request.params.slug,
        path          = '_posts/' + postKey + '.md';
    
    return fs
        .readFileAsync(path, 'utf-8')
        .then(function (data) {
            var blog = {};
            var post = cache.get('posts')[postKey];
            blog.title = post.title;
            blog.post = data;
            blog.tags = post.tags;
            response.send(blog).end();
        })
        .catch(log.error);
}

function getMeta (request, response) {

    var meta = {
        blogsPerPage: config.blogsPerPage,
        defaultCategoryAlias: config.defaultCategoryAlias,
        categories: cache.get('categories')
    };
    response.send(meta).end();
}

module.exports = function (app) {

    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(bodyParser.json());

    app.use(multer({
        dest: '_uploads/'
    }));

    // non-categorized post routes

    app.post('/blogs', addBlog);

    app.get('/blogs', getBlogs);

    app.get('/blogs/post/:year/:month/:date/:slug', getBlog);

    app.put('/blogs/post/:year/:month/:date/:slug', saveBlog);

    app.delete('/blogs/post/:year/:month/:date/:slug', deleteBlog);

    app.get('/blogs/tag/:tag', getBlogsByTag);

    // category post routes

    app.post('/blogs/category/:category', addBlog);

    app.get('/blogs/category/:category', getBlogs);

    app.get('/blogs/category/:category/post/:year/:month/:date/:slug', getBlog);

    app.put('/blogs/category/:category/post/:year/:month/:date/:slug', saveBlog);

    app.delete('/blogs/category/:category/post/:year/:month/:date/:slug', deleteBlog);

    app.get('/blogs/category/:category/tag/:tag', getBlogsByTag);

    // get blog meta route

    app.get('/meta', getMeta);

    app.get('/tags', function (request, response) { response.send(_.keys(cache.get('tags'))).end(); });

    // upload file routes

    app.post('/blogs/upload/post/:year/:month/:date/:slug', uploadFile);

    app.post('/blogs/upload/category/:category/post/:year/:month/:date/:slug', uploadFile);
};