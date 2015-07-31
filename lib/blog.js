/**
 * Created by sumedas on 03-Apr-15.
 */

var _               = require('lodash'),
    Promise         = require('bluebird'),
    fs              = Promise.promisifyAll(require('fs')),
    bodyParser      = require('body-parser'),
    multer          = require('multer'),
    cache           = require('memory-cache'),
    moment          = require('moment'),
    passport        = require('passport'),
    LocalStrategy   = require('passport-local'),
    expressSession  = require('express-session'),
    utils           = require('./utils'),
    jobs            = require('./jobs'),
    Post            = require('./vo').Post,
    MeowError       = require('./vo').MeowError,
    MeowApiError    = require('./vo').MeowApiError,
    StatusMessage   = require('./vo').StatusMessage,
    config          = require('./config').getConfig(),
    log             = config.log;

/**
 * Passport session setup. [https://github.com/jaredhanson/passport-local/blob/master/examples/express3/app.js]
 *
 * To support persistent login sessions, Passport needs to be able to
 * serialize users into and deserialize users out of the session. Typically,
 * this will be as simple as storing the user ID when serializing, and finding
 * the user by ID when deserializing.
 */
passport.serializeUser(function(pUser, pDone) {
    pDone(null, pUser);
});

passport.deserializeUser(function(pObj, pDone) {
    return pDone(null, pObj);
});

/**
 * Use the LocalStrategy within Passport
 *
 * Strategies in passport require a `verify` function, which accept
 * credentials (in this case, a username and password), and invoke a callback
 * with a user object.
 */
passport.use(new LocalStrategy(
    function (pUsername, pPassword, pDone) {

        // asynchronous verification, for effect...
        process.nextTick(function () {

            /**
             * Find the user by username. If there is no user with the given
             * username, or the password is not correct, set the user to `false` to
             * indicate failure and set a flash message. Otherwise, return the
             * authenticated `user`.
             */
            if (pUsername !== process.env['MEOW_USERNAME']) {
                pDone (new MeowError ('Username or password is not correct'));
            }
            else if (pPassword !== process.env['MEOW_PASSWORD']) {
                pDone (new MeowError ('Username or password is not correct'));
            }

            return pDone(null, {username: pUsername});
        });
    }
));

/**
 * Simple route middleware to ensure user is authenticated
 * @param pRequest
 * @param pResponse
 * @param pNext
 * @returns {*}
 */
function ensureAuthenticated(pRequest, pResponse, pNext) {

    if (pRequest.isAuthenticated()) {
        return pNext();
    }

    pResponse.redirect('/nofound');
}

function checkSecretEditUrlParameter (pRequest, pResponse, pNext) {

    // its a must to have a 'secretparam' environment variable and 'meow' parameter in the URL
    if (!pRequest.query.meow ||  !process.env['MEOW_SECRET_QUERY_PARAM']) {
        return pResponse.redirect('/nofound');
    }
    else if (pRequest.query.meow === process.env['MEOW_SECRET_QUERY_PARAM']) {
        return pNext();
    }
    else {
        return pResponse.redirect('/nofound');
    }
}

function addBlog (pRequest, pResponse) {
    var post          = pRequest.body.post,
        metaData      = utils.getMetaData(post),
        publishedDate = moment(metaData['published-date'].toISOString()).format('YYYY-MM-DD'),
        slug          = utils.generateSlug(metaData.title),
        path          = '_posts/' + publishedDate + '-' + slug + '.md';

    fs
        .statAsync(path)
        .then(function (pStat) {
            if (pStat.isFile()) {
                return pResponse.status(500).send(StatusMessage.anotherFileExists);
            }
            else {
                // go to our default course of action, Error is chosen because normally file will not be present
                // and hence statAsync will throw Error, which will then lead us straight to catch block.
                throw new Error ();
            }
        })
        .catch(function () {
            return fs
                .openAsync(path, 'w')
                .then(function () {
                    return fs.writeFileAsync(path, post);
                })
                .then(function () {
                    pResponse.status(200).send(StatusMessage[200]);
                })
                .catch(function (pErr) {
                    log.error(pErr);
                    pResponse.status(500).send(StatusMessage[500]);
                });
        });
}

function saveBlog (pRequest, pResponse) {

    /**
     * One important note: slug and fileName attributes in our blog object received will remain the same as
     * the one we sent to the front-end. In other words, these two attributes won't be changed at all by
     * the front-end. IMO that's a great thing.
     */

    var publishedDate = pRequest.params.year + '-' + pRequest.params.month + '-' + pRequest.params.date,
        path          = '_posts/' + publishedDate + '-' + pRequest.params.slug + '.md',
        post          = pRequest.body.post;

    return fs
        .statAsync(path)
        .then(function (pStat) {
            if (!pStat.isFile()) {
                // file does not exists, send 500
                return pResponse.status(500).send(StatusMessage.noSuchFileExists);
            }
            else {
                /**
                 * Post save, the file will be processed and if the filename turns out to be the same as some other file,
                 * that other file will be deleted. So better throw the error now to warn the user.
                 */
                var postMetaData = utils.getMetaData(post),
                    newPublishedDate = moment(postMetaData['published-date'].toISOString()).format('YYYY-MM-DD'),
                    newSlug = utils.generateSlug(postMetaData.title),
                    newFilePath = '_posts/' + newPublishedDate + '-' + newSlug + '.md';

                return fs
                    .statAsync(newFilePath)
                    .then(function (pStat) {
                        if (pStat.isFile() && newFilePath !== path) {
                            // The file exists! Quickly send response!
                            return pResponse.status(500).send(StatusMessage.couldDeleteAnotherFile);
                        }
                        else {
                            // We found something with same name but it is not a file (???), so we go ahead
                            // and throw MeowError to proceed with save
                            throw new MeowError ();
                        }
                    })
                    .catch(function () {
                        // we caught an error, which means we don't have to worry about any potential conflict

                        // we found our file, lets save the contents in it
                        throw new MeowError ();
                    });
            }
        })
        .catch(MeowError, function () {
            return fs
                .writeFileAsync(path, post)
                .then(function () {
                    return pResponse.status(200).send(StatusMessage[200]);
                })
                .catch(function (pErr) {
                    log.error(pErr);
                    return pResponse.status(500).send(StatusMessage[500]);
                });
        })
        .catch(function (pErr) {
            // file does not exists, simply send 500 with message
            if (pErr.code === 'ENOENT') {
                return pResponse.status(500).send(StatusMessage.noSuchFileExists);
            }
            else {
                log.error(pErr);
                return pResponse.status(500).send(StatusMessage[500]);
            }
        });
}

function deleteBlog (pRequest, pResponse) {
    var publishedDate = pRequest.params.year + '-' + pRequest.params.month + '-' + pRequest.params.date,
        path          = '_posts/' + publishedDate + '-' + pRequest.params.slug + '.md';

    if (!fs.statSync(path).isFile()) {
        throw new MeowApiError ("File does not exists.");
    }

    return fs
        .statAsync(path)
        .then(function (pStat) {
            if (!pStat.isFile()) {
                // file does not exists, send 500
                return pResponse.status(500).send(StatusMessage.noSuchFileExists);
            }
            else {
                // we found our file, lets delete it
                throw new MeowError ();
            }
        })
        .catch(MeowError, function () {
            var tempFilePath = path + '' + Math.random();

            // https://github.com/joyent/node/issues/7164
            // this does not solve EPERM issue for now, but will allow us to create new blog with
            // same name as the one deleted just before when running this app in a Windows machine
            return fs
                .renameAsync(path, tempFilePath)
                .then(function () {
                    return fs.unlinkAsync(tempFilePath);
                })
                .then(function () {
                    // fire up processing blog posts upon deletion, since watching 'unlink' actions is
                    // probably not working in chokidar
                    jobs.process.posts();

                    return pResponse.status(200).send(StatusMessage[200]);
                })
                .catch(function (pErr) {
                    log.error(pErr);
                    return pResponse.status(500).send(StatusMessage[500]);
                });
        })
        .catch(function (pErr) {
            // file does not exists, simply send 500 with message
            if (pErr.code === 'ENOENT') {
                return pResponse.status(500).send(StatusMessage.noSuchFileExists);
            }
            else {
                log.error(pErr);
                return pResponse.status(500).send(StatusMessage[500]);
            }
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
                log.error(error);
                pResponse.status(500).send(StatusMessage[500]);
            }

            pResponse.send(pRequest.files).end();
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
    return pResponse.status(201).send(blogsToSend).end();
}

function redirectToEdit (pRequest, pResponse)
{
    return pResponse.redirect('/blogs/edit');
}

function generateLoginPage (pRequest, pResponse) {

    // http://stackoverflow.com/questions/21617468/node-js-generate-html

    var html = '<!DOCTYPE html><html><head lang="en"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +

                '<title>Login</title></head><body><form action="/blogs/edit/login" method="post">' +

                'Username:  <input type="text" name="username" /><br><br>Password:  <input type="password" name="password" />' +

                '<br><br><input type="submit"></form></body></html>';

    pResponse.writeHead(200, {
        'Content-Type': 'text/html',
        'Content-Length': html.length,
        'Expires': new Date().toUTCString()
    });
    pResponse.end(html);
}

function getEditPage (pRequest, pResponse)
{
    return pResponse.sendFile(utils.getFilePathRelativeToAppRoot(config.editPageName));
}

module.exports = function (pServer) {

    pServer.use(require('cookie-parser')());

    pServer.use(bodyParser.urlencoded({
        extended: true
    }));

    pServer.use(bodyParser.json());

    pServer.use(expressSession(config.session));

    pServer.use(multer({
        dest: '_uploads/'
    }));

    pServer.use(
        (function () {
            var prerenderConfig = config.prerender;
            if (!!prerenderConfig.whitelist && !(prerenderConfig.whitelist instanceof Array))
            {
                throw new MeowError ("prerender.whitelist must be an array");
            }
            if (!!prerenderConfig.blacklist && !(prerenderConfig.blacklist instanceof Array))
            {
                throw new MeowError ("prerender.blacklist must be an array");
            }

            var prerenderMiddleware = require('prerender-node');

            for (var prop in prerenderConfig)
            {
                prerenderMiddleware.set(prop, prerenderConfig[prop]);
            }

            return prerenderMiddleware;
        })()
    );

    // Initialize Passport! Also use passport.session() middleware, to support
    // persistent login sessions (recommended).
    pServer.use(passport.initialize());
    pServer.use(passport.session());

    pServer.get('/blogs/edit/login', checkSecretEditUrlParameter, generateLoginPage);

    pServer.post('/blogs/edit/login', passport.authenticate('local', { failureRedirect: '/nofound' }), redirectToEdit);

    pServer.get('/blogs/edit/logout', function (pRequest, pResponse) {
        pRequest.logout();
        pResponse.redirect('/');
    });

    pServer.get('/blogs/edit', ensureAuthenticated, getEditPage);

    pServer.post('/api/blogs', ensureAuthenticated, addBlog);

    pServer.get('/api/blogs', getBlogs);

    pServer.get('/api/blogs/posts/:year/:month/:date/:slug', getBlog);

    pServer.put('/api/blogs/posts/:year/:month/:date/:slug', ensureAuthenticated, saveBlog);

    pServer.delete('/api/blogs/posts/:year/:month/:date/:slug', ensureAuthenticated, deleteBlog);

    pServer.get('/api/blogs/tags/:tag', getBlogsByTag);

    // search blogs by keywords
    pServer.get('/api/blogs/query/:query', findBlogs);

    // get blog meta route
    pServer.get('/api/meta', getMeta);

    /**
      * upload file routes
      */
    pServer.post('/api/blogs/upload/post/:year/:month/:date/:slug', ensureAuthenticated, uploadFile);

    //
    pServer.get(/^\/sitemap.*.xml$/, function (pRequest, pResponse) {
        pResponse.sendFile(utils.getFilePathRelativeToAppRoot('.' + pRequest.originalUrl));
    });

    // Error handling middleware - http://expressjs.com/guide/error-handling.html
    // http://stackoverflow.com/questions/7151487/error-handling-principles-for-node-js-express-js-applications
    pServer.use(function (pErr, pRequest, pResponse, pNext) {
        if (pErr)
        {
            log.error(pErr);
            if (pErr instanceof MeowApiError || pErr instanceof MeowError)
            {
                return pResponse.status(500).send(pErr.message);
            }
            return pResponse.status(500).send('My name is Error. Unknown Error');
        }
    });

    pServer.get('*', function (pRequest, pResponse) {
        return pResponse.sendFile(utils.getFilePathRelativeToAppRoot(config.indexPageName));
    });

    // http://expressjs.com/starter/faq.html#how-do-you-handle-404s-
    pServer.use(function (pRequest, pResponse) {
        pResponse.status(404).send(StatusMessage[404]);
    });
};