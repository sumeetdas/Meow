angular
    .module('meow.blog.view', ['ui.router', 'blogViewTemplates', 'ngSanitize', 'ui.select', 'hc.marked'])
    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider
            .state('blog', {
                abstract: true,
                views: {
                    blogView: {
                        controller: 'BlogViewCtrl',
                        templateUrl: 'blog-view.base.tpl.html'
                    }
                }
            })
            .state('blog.list', {
                url: '/blogs',
                views: {
                    main: {
                        controller: 'BlogViewListCtrl',
                        templateUrl: 'blog-view.list.tpl.html'
                    }
                }
            })
            .state('blog.list.tag', {
                url: '/tag/:tag',
                views: {
                    main: {
                        controller: 'BlogViewListCtrl',
                        templateUrl: 'blog-view.list.tpl.html'
                    }
                }
            })
            .state('blog.view', {
                url: '/blogs/post/:year/:month/:date/:slug',
                views: {
                    main: {
                        controller: 'BlogViewPostCtrl',
                        templateUrl: 'blog-view.post.tpl.html'
                    },
                    side: {
                        controller: 'BlogViewPostSideCtrl',
                        templateUrl: 'blog-view.post.side.tpl.html'
                    }
                }
            });
    }]);
/**
 * Created by sumedas on 30-Apr-15.
 */
angular
    .module('meow.blog.view')
    .service('$blogView', ['$http', function ($http) {
        var username = 'Sumeet Das', currentPageNo = 1, pageCount = 1,
            blogsPerPage = 2, pageBlogList = [], tags = [];

        function getTags (pCallBack) {
            if (tags.length === 0) {
                $http
                    .get('/tags')
                    .success(function (data) {
                        if (!data || ! data instanceof Array) {
                            data = ['meow','bow'];
                        }
                        tags = data;
                        pCallBack(data);
                    })
                    .error(console.error);
            }
            else {
                pCallBack(tags);
            }
        }

        function computePageCount () {
            var len = pageBlogList.length;
            return len ? parseInt (len / blogsPerPage) + (len % blogsPerPage === 0 ? 0 : 1) : 1;
        }

        function getBlogsByTag (pTag, pCallBack) {
            $http
                .get('/blogs/tag/' + pTag)
                .success(function (data) {
                    pageBlogList = data;
                    pageCount = computePageCount();
                    currentPageNo = 1;
                    if (typeof pCallBack === 'function') {
                        pCallBack (pageBlogList.slice(0, blogsPerPage));
                    }
                })
                .error(console.error);
        }

        function getBlogs (pCallBack) {
            $http
                .get('/blogs')
                .success(function (data) {
                    pageBlogList = data;
                    pageCount = computePageCount();
                    currentPageNo = 1;
                    if (typeof pCallBack === 'function') {
                        pCallBack (pageBlogList.slice(0, blogsPerPage));
                    }
                })
                .error(console.error);
        }

        function getPrevBlogs (pCallBack) {
            if (currentPageNo > 1) {
                currentPageNo = currentPageNo - 1;
                pCallBack (pageBlogList.slice( (currentPageNo - 1) * blogsPerPage, currentPageNo * blogsPerPage));
            }
        }

        function getNextBlogs (pCallBack) {
            if (currentPageNo < pageCount) {
                currentPageNo = currentPageNo + 1;
                pCallBack (pageBlogList.slice( (currentPageNo - 1) * blogsPerPage, currentPageNo * blogsPerPage));
            }
        }

        function parseFileName (pFileName) {
            if (typeof pFileName !== 'string') {
                throw new Error ('pFileName is not a string');
            }

            var arr   = pFileName.split('-'),
                year  = arr.shift(),
                month = arr.shift(),
                date  = arr.shift(),
                slug  = arr.join('-');

            var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];

            return {
                year: year,
                month: month,
                date: date,
                slug: slug,
                formattedDate: months[month - 1] + ' ' + parseInt(date) + ', ' + year
            }
        }

        function getBlogDateFormat () {

        }

        return {
            getCurrentPageNo: function () { return currentPageNo; },
            getPageCount: function () { return pageCount; },
            getBlogsByTag: getBlogsByTag,
            getBlogs: getBlogs,
            getPrevBlogs: getPrevBlogs,
            getNextBlogs: getNextBlogs,
            getTags: getTags,
            parseFileName: parseFileName,
            getUserName: function () { return username; },
            setUserName: function (pUserName) { username = pUserName; },
            getBlogsPerPage: function () { return blogsPerPage; },
            setBlogsPerPage: function (pBlogsPerPage) { blogsPerPage = pBlogsPerPage; }
        };
    }])
/**
 * Created by sumedas on 30-Apr-15.
 */
angular
    .module('meow.blog.view')
    .directive('post',['$compile', 'marked', function ($compile, marked){
        return {
            restrict: 'A',
            replace: true,
            link: function (scope, iElem, iAttrs) {
                scope.$watch(iAttrs.post, function(markDown) {
                    if (markDown && typeof markDown === 'string' && markDown.length !== 0) {
                        iElem.html(marked(markDown));
                        $compile(iElem.contents())(scope);//
                    }
                });
            }
        }
    }]);
/**
 * Created by sumedas on 30-Apr-15.
 */
angular
    .module('meow.blog.view')
    .controller('BlogViewListCtrl', ['$scope', '$blogView', '$state', function ($scope, $blogView, $state) {

        // change values upon the change in $blogView service property value
        var unRegister = $scope.$watch(function () { return $blogView.getUserName(); }, function (pNewVal) {
            $scope.username = pNewVal;
            unRegister();
        });

        /**
         * Load blogs on state change
         * This controller is used by two states and is required to load
         * blogs based on whether the URL is /blogs/tag/:tag or not.
         */
        $scope.$on('$stateChangeSuccess', function loadBlogs () {
            if (undefined === $state.params.tag) {
                $blogView.getBlogs(function (pData) {
                    $scope.blogs = pData;
                });
            } else {
                console.log($state.params.tag);
                $blogView.getBlogsByTag($state.params.tag, function (pData) {
                    $scope.blogs = pData;
                });
            }
        });
        // load next set of blogs
        $scope.next = function () {
            $blogView.getNextBlogs(function (data) {
                $scope.blogs = data;
            })
        };
        // load previous set of blogs
        $scope.prev = function () {
            $blogView.getPrevBlogs(function (data) {
                $scope.blogs = data;
            });
        };
        // determine if the current page is the first page of the result list
        $scope.isFirstPage = function () {
            return $blogView.getCurrentPageNo() === 1;
        };
        // determine if the current page is the last page of the result list
        $scope.isLastPage = function () {
            return $blogView.getCurrentPageNo() === $blogView.getPageCount();
        };
        $scope.getFormattedDate = function (pBlog) {
            return $blogView.parseFileName(pBlog.fileName).formattedDate;
        };
        // function to go to blog.view state when the title is clicked upon
        $scope.goToBlog = function (pBlog) {
            var metaData = $blogView.parseFileName(pBlog.fileName);

            $state.go('blog.view', {
                year: metaData.year,
                month: metaData.month,
                date: metaData.date,
                slug: metaData.slug
            });
        };
    }])
    .controller('BlogViewPostCtrl', ['$scope', '$http', '$stateParams', '$blogView', function ($scope, $http, $stateParams) {
        $http
            .get('/blogs/post/' + $stateParams.year + '/' + $stateParams.month + '/' + $stateParams.date + '/' + $stateParams.slug)
            .success(function (pData) {
                $scope.blog = pData;
            })
            .error(console.error);
    }])
    .controller('BlogViewPostSideCtrl', [function () {

    }])
    .controller('BlogViewCtrl', ['$blogView', '$scope', '$state', function ($blogView, $scope, $state) {

        // needed for ui select
        $scope.queryTag = {};

        // loads tags
        $blogView.getTags (function (data) {
            $scope.tags = data;
        });

        $scope.getBlogsByTag = function (pTag) {
            $state.go('blog.list.tag', {
                tag: pTag
            });
        };
    }]);
angular.module("blogViewTemplates", []).run(["$templateCache", function($templateCache) {$templateCache.put("blog-view.base.tpl.html","<div class=\"container\">\r\n    <div class=\"row\">\r\n        <div class=\"col-lg-7 col-lg-offset-2 col-md-10 col-md-offset-1 blog-main\" ui-view=\"main\"></div>\r\n        <div class=\"col-lg-3 col-md-6 col-xs-12\">\r\n            <div class=\"nav-block affix\">\r\n                <div class=\"row\">\r\n                    <div class=\"col-lg-10 col-md-12 col-sm-12 col-xs-12\">\r\n                        <ui-select ng-model=\"queryTag.selected\" theme=\"bootstrap\" ng-disabled=\"disabled\" title=\"Enter tag\">\r\n                            <ui-select-match placeholder=\"TAG\">{{$select.selected}}</ui-select-match>\r\n                            <ui-select-choices repeat=\"tag in tags | filter: $select.search\">\r\n                                <div ng-bind-html=\"tag | highlight: $select.search\"></div>\r\n                            </ui-select-choices>\r\n                        </ui-select>\r\n                    </div>\r\n                    <div class=\"col-lg-2 col-md-12 col-sm-12 col-xs-12 center-block\">\r\n                        <button class=\"btn btn-default center-block\" ng-click=\"getBlogsByTag(queryTag.selected)\">Go!</button>\r\n                    </div>\r\n                </div>\r\n                <hr>\r\n                <div ui-view=\"side\"></div>\r\n            </div>\r\n        </div>\r\n    </div>\r\n</div>");
$templateCache.put("blog-view.list.tpl.html","<div>\r\n    <div ng-repeat=\"blog in blogs\">\r\n        <div class=\"post-preview\" ng-if=\"blogs\">\r\n            <a href=\"#\" ng-click=\"goToBlog(blog);\">\r\n                <h2 class=\"post-title\">\r\n                    {{blog.title}}\r\n                </h2>\r\n                <h3 class=\"post-subtitle\" ng-if=\"blog.subtitle\">\r\n                    {{blog.subtitle}}\r\n                </h3>\r\n            </a>\r\n            <div class=\"post-meta\">Posted by <a ng-href=\"/#/blogs\">{{username}}</a> on {{getFormattedDate(blog)}}</div>\r\n            <div class=\"post-meta\"><i class=\"fa fa-tags\"></i> <em ng-repeat=\"tag in blog.tags\"><a class=\"tag-link\" ng-href=\"/#/blogs/tag/{{tag}}\">{{tag}}</a>{{$last ? \'\' : \', \'}}</em></div>\r\n        </div>\r\n        <div class=\"post-preview\" ng-if=\"blogs === [] || !blogs\">\r\n            <h2>No blogs found saaaaaar!</h2>\r\n        </div>\r\n        <hr>\r\n    </div>\r\n    <ul class=\"pager\">\r\n        <li class=\"previous\">\r\n            <a href=\"#\" ng-if=\"!isFirstPage()\" ng-click=\"prev()\">Previous</a>\r\n        </li>\r\n        <li class=\"next\">\r\n            <a href=\"#\" ng-if=\"!isLastPage()\" ng-click=\"next()\">Next</a>\r\n        </li>\r\n    </ul>\r\n</div>");
$templateCache.put("blog-view.post.side.tpl.html","");
$templateCache.put("blog-view.post.tpl.html","<div>\r\n    <h1>{{blog.title}}</h1>\r\n\r\n    <div post=\"blog.post\"></div>\r\n\r\n    <i class=\"fa fa-tags\"></i> <em ng-repeat=\"tag in blog.tags\"><a class=\"tag-link\" ng-href=\"/#/blogs/tag/{{tag}}\">{{tag}}</a>{{$last ? \'\' : \', \'}}</em>\r\n\r\n    <!--<dir-disqus disqus_shortname=\"{{disqus.shortname}}\" disqus_identifier=\"{{disqus.id}}\" disqus_url=\"{{$location.url}}\" disqus_category_id=\"{{disqus.categoryID}}\"\r\n    ready-to-bind=\"{{disqus.loaded}}\" disqus_title=\"{{disqus.title}}\" disqus_config_language=\"{{disqus.configLanguage}}\" disqus_disable_mobile=\"{{disqus.disableMobile}}\">\r\n        </dir-disqus>-->\r\n\r\n    <!--<div class=\"col-lg-2\">\r\n            <table class=\"table\">\r\n                <tr><td><div fb-like></div></td></tr>\r\n                <tr><td><div tweet></div></td></tr>\r\n                <tr><td><div google-plus></div></td></tr>\r\n            </table>\r\n        </div>-->\r\n</div>");}]);