# Meow
Meow is a NodeJS + AngularJS based blogging engine which is aimed at making blogs using AngularJS as front-end more easy to share and being crawled by various search bots.

This repository contains the code for the NodeJS based blogging engine which also serves as a REST API. To visit its AngularJS based front-end modules, please visit [Meow-BlogView](https://github.com/sumeetdas/Meow-BlogView) (module for viewing blogs) and [Meow-BlogEdit](https://github.com/sumeetdas/Meow-BlogEdit) (module for editing blogs).

### Installation

To install Meow, execute the following command:

```
npm install meow-blog
```

Since this blog engine acts only as a REST API serving blog contents, you could either create a new front-end module on top of this API or use Meow-BlogView and Meow-BlogEdit AngularJS modules to view and edit blogs respectively. 

To install both of them, execute the following command:

```
bower install meow-blogview meow-blogedit
```

### Structure of the blog directory and a typical post

Meow requires the blog posts to be present under '_posts' folder and will quite often process this directory. 

It will also create sitemaps, robots.txt files at startup at the root of the app. 

Meow needs the location of index.html and edit.html in order to serve them during runtime. By default, it will create them 
in /public folder. You could, however, change their locations by setting the editPageName' and 'indexPageName' 
config properties.

The format of a typical blog post is as follows:

```
<!--
published-date:
title:
subtitle:
tags:
keywords:
-->

Write your post here....
```

The text between <!-- and --> is the metadata region of the blog post and is written in YAML format. The ending and closing 
comment tags (<!-- and -->) are important and must be at the top of the post file and the text in between them must be written 
in YAML. Note that other than 'title', other metadata properties are optional.

### Jobs handled by Meow

1. Creates '_posts' and '_uploads' folder automatically if they do not exist. Meow will NEVER delete them once it finds out that they exist in the directory.

2. Creates robots.txt and sitemap.xml files if they do not exist. Meow will NEVER delete/overwrite them once it finds out that they exist in the directory.

3. Creates/overwrites sitemap-posts.xml (sitemap containing URLs of all the posts available in _posts directory) and sitemap-tags.xml (sitemap containing URLs of all the tags) everytime the server starts.

4. Meow also serves as a REST API for blogs. More information on REST routes are given below under the heading [Routes](#routes).

5. Meow will allow a user to enter into the edit mode only if he/she accesses the following url: 
   ```
   http://www.meow.com/blogs/edit/login?meow=[MEOW_SECRET_QUERY_PARAM]
   ```
  followed by entering a username and a password which must be same as [MEOW_USERNAME] and [MEOW_PASSWORD]. 
  These three are the environment variables which a user must set in order to enable himself/herself to enter the edit mode.

6. Meow can search blogs based on their titles, tags and keywords. Since Meow right now does not search a post's content, it is advised to supply certain keywords instead which might be useful while querying. 

7. The engine will parse all of the files in the very beginning and after everytime a file is added, updated or deleted. It will perform the following tasks:
  
  a. Check whether the post begin with <!-- and is ultimately followed by -->. If not, an error will be logged and the post will be ignored
  
  b. Check whether the metadata region contains syntactically correct YAML content, or else will log an error
  
  c. Generates a published date if it does not exist and writes it in the post's metadata region
  
  c. Renames the file to the slug generated based on the published date and title of the post (available in metadata region)

8. Meow will automatically create index.html and edit.html files in the /public folder which to assist the user with setting up the blog app with less effort. You could notify Meow about their new locations by setting 'editPageName' and 'indexPageName' config properties.

9. It includes prerender-node which can be configured to fetch statically rendered page when google or some other search engine bot crawls your site.

### Routes

1. GET /blogs/edit/login?meow=[MEOW_SECRET_QUERY_PARAM]
  This will fetch the page where the login will be asked to enter correct username and password before he/she could access the edit page

2. POST /blogs/edit/login
  This will post username and password to the server

3. GET /blogs/edit/logout
  This will log out the user from edit mode and redirect him/her to the default route (serving index.html)

4. GET /blogs/edit
  This will fetch the edit page

5. POST /api/blogs
  This will create a new blog post. User will be checked if he/she is currently logged in.

6. PUT /api/blogs/posts/:year/:month/:date/:slug
  This will edit a current blog post. User will be checked if he/she is currently logged in.

7. DELETE /api/blogs/posts/:year/:month/:date/:slug
  This will delete a current blog post. User will be checked if he/she is currently logged in.
  
8. POST /api/blogs/upload/post/:year/:month/:date/:slug
  This will upload a file to /_uploads folder. User will be checked if he/she is currently logged in.

9. GET /api/blogs
  Get a list of blogs sorted from newest to oldest (according to published-date)

10. GET /api/blogs/posts/:year/:month/:date/:slug
  Get a blog post based on published-date's year, month and date and its slug

11. GET /api/blogs/tags/:tag
  Get blogs by tag.

12. GET /api/blogs/query/:query
  Get blogs by query.

13. GET /api/meta
  Get blog meta. Used by Meow-BlogView and Meow-BlogEdit

14. GET /robots.txt
  Gets robots.txt file

15. GET /^\/sitemap.*.xml$/
  Gets any sitemap available in the root directory of the app

16. GET *
  Servers index.html for all other routes. Added because of the two accompanying AngularJS modules as refreshing page when HTML5 push state is enabled would cause 404.

### Config and setup of Meow engine

Available configs: 

```
  {
    log: {
        info: console.log,
        error: console.error
    },
    
    blogsPerPage: 5,
    
    username: 'John Doe',
    
    disqus: {
        shortname: ''
    },
    
    angularSocialShare: {
        facebook: {
            appId: ''
        },
        twitter: {
            handle: ''
        }
    },

    // prerender-node settings
    prerender: {
    },

    // file path is relative to project's root directory
    editPageName: './public/edit.html',

    // file path relative to project's root directory where blogs will be viewed
    indexPageName: './public/index.html',

    // https://github.com/expressjs/session#options
    session: {
        secret: '',
        resave: true,
        saveUninitialized: true
    },

    // url of your site, e.g. http://www.example.com. This format must be adhered to.
    siteUrl: 'http://www.example.com'
  }
```

Setup:

```  
  engine
    .config(function (pConfig) {
        pConfig
            .setConfig('username', '')
            .setConfig('disqus.shortname', '')
            .setConfig('prerender', {
                prerenderServiceUrl: '',
                prerenderToken: ''
            })
            .setConfig('angularSocialShare', {
                facebook: {
                    appId: ''
                },
                twitter: {
                    handle: ''
                }
            });
    })
    // app is your express app, usually created as follows var app = express();
    .blog(app, userDefinedRouter) //created using express.Router()
    .jobs(function (pJobs) {
        pJobs
            .startup()
            .then(function () {
                app.listen(5000, function () {
                    console.log('The server is running at port:5000');
                });
            });
    });
```

### License

MIT License, Copyright (c) 2015 Sumeet Das
