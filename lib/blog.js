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
};

function saveBlog (request, response) {
    var publishedDate = request.params.year + '-' + request.params.month + '-' + request.params.day,
        path          = '_posts/' + publishedDate + '-' + request.params.slug + '.md';

    return fs
        .writeFileAsync(path, request.body.post)
        .then(function () {
            response.status(200).end();
        });
}

function deleteBlog (request, response) {
    var filePath = '_posts/' + request.params.year + '/' + request.params.month + '/' + request.params.day + '/' + request.params.slug + '.md';

    return fs
        .unlinkAsync(filePath)
        .then(function () {
            response.send(200).end();
        });
}

function getDefaultList (request, response) {

    /*var page   = parseInt(request.params.page || 1) - 1,
        limit  = 4;*/

    var fileNames = cache.get('defaultOrder') || [];

    /*if (!!fileNames [page * limit]) {
        fileNames = fileNames.slice(page*limit, (page+1)*limit);
    }*/

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

    var page   = parseInt(request.params.page || 1) - 1,
        tag    = request.params.tag,
        limit  = 4;

    var tags = cache.get('tags') || {};

    var postsWithGivenTag = tags[tag] || [];

    if (! (postsWithGivenTag instanceof Array) ) {
        throw new Error ('postsWithGivenTag is not an array.');
    }

    return utils
        .getCachedPostsData(postsWithGivenTag)
        .then(function (data) {
            response.send(data).end();
        });
}

function getBlog (request, response) {
    var publishedDate = request.params.year       + '-' + request.params.month + '-' + request.params.day,
        path          = '_posts/' + publishedDate + '-' + request.params.slug + '.md';
    
    return fs
        .readFileAsync(path)
        .then(function (data) {
            response.send(data).end();
        })
        .catch(log.error);
}

module.exports = function (app) {

    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(bodyParser.json());

    app.use(multer({
        dest: '_uploads/',
        onFileUploadStart: function (file, request) {
            console.log(file.originalname + ' is starting ... \n', request.params);
        },
        onFileUploadComplete: function (file, request, response) {

            /*console.log('done\n', request.params, '\n', request.files, '\n');

            var uploadDirName = request.params.year + '-' + request.params.month + '-'+
                                request.params.day  + '-' + request.params.slug;

            if (!uploadDirName) {
                response.send(501).end();

            } else {
                var uploadDirPath = path.dirname(file.path);
                exec('mv ' + file.path + ' ' + uploadDirPath + '/' + uploadDirName)
                    .then(function (){
                        response.send(200).end();
                    });
            }*/
        }
    }));

    app.get('/blogs/post/:year/:month/:day/:slug', getBlog);

    app.post('/blogs', addBlog);

    app.put('/blogs/post/:year/:month/:day/:slug', saveBlog);

    app.delete('/blogs/post/:year/:month/:day/:slug', deleteBlog);

    app.get('/blogs', getDefaultList);

    app.get('/blogs/tag/:tag', getBlogsByTag);

    app.get('/tags', function (request, response) { response.send(_.keys(cache.get('tags'))).end(); });

    app.post('/blogs/upload/:year/:month/:day/:slug', function (request) {
        console.log('done\n', request.params, '\n', request.files, '\n');

        var uploadDirName = request.params.year + '-' + request.params.month + '-'+
            request.params.day  + '-' + request.params.slug;

        if (!uploadDirName) {
            response.send(501).end();

        } else {
            var uploadDirPath = '/home/sumedas/Meow-Github/_uploads/';//path.dirname(file.path);
            exec('mv ' + uploadDirPath + request.files['m'].name + ' ' + uploadDirPath + uploadDirName)
                .then(function (){
                    response.send(200).end();
                });
        }
    });

};