/**
 * Created by sumedas on 31-Mar-15.
 */
angular
    .module('meow.blog.edit',['ui.router', 'blogEditTemplates', 'ngSanitize', 'ui.select', 'hc.marked', 'toggle-switch'])
    .config(['$stateProvider', function ($stateProvider) {
        $stateProvider
            .state('blog', {
                abstract: true,
                views: {
                    blogEdit: {
                        controller: 'BlogEditCtrl',
                        templateUrl: 'blog-edit.base.tpl.html'
                    }
                }
            })
            .state('blog.list', {
                url: '/blogs',
                views: {
                    main: {
                        controller: 'BlogEditListCtrl',
                        templateUrl: 'blog-edit.list.tpl.html'
                    }
                }
            })
            .state('blog.list.tag', {
                url: '/tag/:tag',
                views: {
                    main: {
                        controller: 'BlogEditListCtrl',
                        templateUrl: 'blog-edit.list.tpl.html'
                    }
                }
            })
            .state('blog.edit', {
                url: '/blogs/:year/:month/:date/:slug',
                views: {
                    main: {
                        controller: 'BlogEditPostCtrl',
                        templateUrl: 'blog-edit.post.tpl.html'
                    },
                    side: {
                        controller: 'BlogEditPostSideCtrl',
                        templateUrl: 'blog-edit.post.side.tpl.html'
                    }
                }
            });
    }]);
/**
 * Created by sumedas on 01-May-15.
 */
angular
    .module('meow.blog.edit')
    .service('$blogEdit', ['$http', function ($http) {
        var currentPageNo = 1, pageCount = 1, blogsPerPage = 5, pageBlogList = [], tags = [],
            currentBlog = '';

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

        function getBlog (pBlog, pCallBack, pCache) {
            if (pCache) {
                pCallBack (currentBlog);
            }
            else {
                $http
                    .get('/blogs/post/' + pBlog.year + '/' + pBlog.month + '/' + pBlog.date + '/' + pBlog.slug)
                    .success(function (pData) {
                        currentBlog = pData;
                        pCallBack(currentBlog);
                    })
                    .error(console.error);
            }
        }

        function saveBlog (pBlog) {
            var isNewBlog = !pBlog.slug || !pBlog.year || !pBlog.month || !pBlog.date;

            if (isNewBlog) {
                $http
                    .post('/blogs', pBlog.post)
                    .success(console.log)
                    .error(console.error);
            }
            else {
                $http
                    .put('/blogs/' + pBlog.year + '/' + pBlog.month + '/' + pBlog.date + '/' + pBlog.slug)
                    .success(console.log)
                    .error(console.error);
            }
        }

        function deleteBlog (pBlog) {
            $http
                .delete('/blogs/' + pBlog.year + '/' + pBlog.month + '/' + pBlog.date + '/' + pBlog.slug)
                .success(console.log)
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

        return {
            getCurrentPageNo: function () {  return currentPageNo; },
            getPageCount: function () { return pageCount; },
            getBlogsByTag: getBlogsByTag,
            getBlogs: getBlogs,
            getBlog: getBlog,
            saveBlog: saveBlog,
            deleteBlog: deleteBlog,
            getPrevBlogs: getPrevBlogs,
            getNextBlogs: getNextBlogs,
            getTags: getTags,
            parseFileName: parseFileName,
            getBlogsPerPage: function () { return blogsPerPage; },
            setBlogsPerPage: function (pBlogsPerPage) { blogsPerPage = pBlogsPerPage; }
        };
    }]);
/**
 * Created by sumedas on 01-May-15.
 */
angular
    .module('meow.blog.edit')
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
 * Created by sumedas on 01-May-15.
 */
angular
    .module('meow.blog.edit')
    .controller('BlogEditListCtrl', ['$scope', '$blogEdit', '$state', function ($scope, $blogEdit, $state) {
        /**
         * Load blogs on state change
         * This controller is used by two states and is required to load
         * blogs based on whether the URL is /blogs/tag/:tag or not.
         */
        $scope.$on('$stateChangeSuccess', function loadBlogs () {
            if (undefined === $state.params.tag) {
                $blogEdit.getBlogs(function (pData) {
                    $scope.blogs = pData;
                });
            } else {
                console.log($state.params.tag);
                $blogEdit.getBlogsByTag($state.params.tag, function (pData) {
                    $scope.blogs = pData;
                });
            }
        });
        // load next set of blogs
        $scope.next = function () {
            $blogEdit.getNextBlogs(function (data) {
                $scope.blogs = data;
            })
        };
        // load previous set of blogs
        $scope.prev = function () {
            $blogEdit.getPrevBlogs(function (data) {
                $scope.blogs = data;
            });
        };
        // determine if the current page is the first page of the result list
        $scope.isFirstPage = function () {
            return $blogEdit.getCurrentPageNo() === 1;
        };
        // determine if the current page is the last page of the result list
        $scope.isLastPage = function () {
            return $blogEdit.getCurrentPageNo() === $blogEdit.getPageCount();
        };
        $scope.getFormattedDate = function (pBlog) {
            return $blogEdit.parseFileName(pBlog.fileName).formattedDate;
        };
        // function to go to blog.edit state when the title is clicked upon
        $scope.goToBlog = function (pBlog) {
            var metaData = $blogEdit.parseFileName(pBlog.fileName);

            $state.go('blog.edit', {
                year: metaData.year,
                month: metaData.month,
                date: metaData.date,
                slug: metaData.slug
            });
        };
    }])
    .controller('BlogEditPostCtrl', ['$scope', '$http', '$stateParams', '$blogEdit', function ($scope, $http, $stateParams, $blogEdit) {

        $scope.editMode = true; // switching to edit mode by default
        $scope.tags = []; // needed for ui-select; resolves this error: TypeError: Cannot read property 'length' of undefined at ctrl.getPlaceholder

        var year = $stateParams.year,
            month = $stateParams.month,
            date = $stateParams.date,
            slug = $stateParams.slug;

        // loads tags
        $blogEdit.getTags (function (data) {
            $scope.tags = data;
        });

        // loads blog
        $blogEdit.getBlog({
            year: year,
            month: month,
            date: date,
            slug: slug
        }, function (pData) {
            $scope.blog = pData;
        });

        $scope.revertEdit = function () {
            $blogEdit.getBlog({
                year: year,
                month: month,
                date: date,
                slug: slug
            }, function (pData) {
                $scope.blog.post = pData;
            }, true);
        };

        $scope.saveBlog = function () {
            $blogEdit.saveBlog({
                post: $scope.blog.post,
                year: year,
                month: month,
                date: date,
                slug: slug
            });
        };

        $scope.deleteBlog = function () {
            $blogEdit.deleteBlog({
                year: year,
                month: month,
                date: date,
                slug: slug
            });
        }
    }])
    .controller('BlogEditPostSideCtrl', [function () {

    }])
    .controller('BlogEditCtrl', ['$blogEdit', '$scope', '$state', function ($blogEdit, $scope, $state) {
        // needed for ui select
        $scope.queryTag = {};

        // loads tags
        $blogEdit.getTags (function (data) {
            $scope.tags = data;
        });

        $scope.getBlogsByTag = function (pTag) {
            $state.go('blog.list.tag', {
                tag: pTag
            });
        };
    }]);
angular.module("blogEditTemplates", []).run(["$templateCache", function($templateCache) {$templateCache.put("blog-edit.base.tpl.html","<div class=\"container\">\r\n    <div class=\"row\">\r\n        <div class=\"col-lg-7 col-lg-offset-2 col-md-10 col-md-offset-1\" ui-view=\"main\"></div>\r\n        <div class=\"col-lg-3 col-md-6 col-xs-12\">\r\n            <div class=\"nav-block affix\">\r\n                <div class=\"row\">\r\n                    <div class=\"col-lg-10 col-md-12 col-sm-12 col-xs-12\">\r\n                        <ui-select ng-model=\"queryTag.selected\" theme=\"bootstrap\" ng-disabled=\"disabled\" title=\"Enter tag\">\r\n                            <ui-select-match placeholder=\"TAG\">{{$select.selected}}</ui-select-match>\r\n                            <ui-select-choices repeat=\"tag in tags | filter: $select.search\">\r\n                                <div ng-bind-html=\"tag | highlight: $select.search\"></div>\r\n                            </ui-select-choices>\r\n                        </ui-select>\r\n                    </div>\r\n                    <div class=\"col-lg-2 col-md-12 col-sm-12 col-xs-12 center-block\">\r\n                        <button class=\"btn btn-default center-block\" ng-click=\"getBlogsByTag(queryTag.selected)\">Go!</button>\r\n                    </div>\r\n                </div>\r\n                <hr>\r\n                <div ui-view=\"side\"></div>\r\n            </div>\r\n        </div>\r\n    </div>\r\n</div>");
$templateCache.put("blog-edit.list.tpl.html","<div class=\"row\">\r\n    <div class=\"col-lg-12 col-md-12 col-sm-12 col-xs-12\" ng-repeat=\"blog in blogs\">\r\n        <div class=\"post-preview\" ng-if=\"blogs\">\r\n            <a ng-click=\"goToBlog(blog);\">\r\n                <h2 class=\"post-title\">\r\n                    {{blog.title}}\r\n                </h2>\r\n                <h3 class=\"post-subtitle\" ng-if=\"blog.subtitle\">\r\n                    {{blog.subtitle}}\r\n                </h3>\r\n            </a>\r\n            <div class=\"post-meta\">Posted by <a ng-href=\"/#/blogs\">{{username}}</a> on {{getFormattedDate(blog)}}</div>\r\n            <div class=\"post-meta\"><i class=\"fa fa-tags\"></i> <em ng-repeat=\"tag in blog.tags\"><a class=\"tag-link\" ng-href=\"/#/blogs/tag/{{tag}}\">{{tag}}</a>{{$last ? \'\' : \', \'}}</em></div>\r\n        </div>\r\n        <div class=\"post-preview\" ng-if=\"blogs === [] || !blogs\">\r\n            <h2>No blogs found saaaaaar!</h2>\r\n        </div>\r\n        <hr>\r\n    </div>\r\n    <ul class=\"pager\">\r\n        <li class=\"previous\">\r\n            <a href=\"#\" ng-if=\"!isFirstPage()\" ng-click=\"prev()\">Previous</a>\r\n        </li>\r\n        <li class=\"next\">\r\n            <a href=\"#\" ng-if=\"!isLastPage()\" ng-click=\"next()\">Next</a>\r\n        </li>\r\n    </ul>\r\n</div>");
$templateCache.put("blog-edit.post.side.tpl.html","");
$templateCache.put("blog-edit.post.tpl.html","<div class=\"row\">\r\n    <form class=\"form-horizontal\">\r\n        <div class=\"form-group\">\r\n            <label for=\"blogTitle\" class=\"col-lg-2 col-md-2 col-sm-2 control-label\">Title</label>\r\n            <div class=\"col-lg-10 col-md-10 col-sm-10\">\r\n                <input class=\"form-control\" id=\"blogTitle\" placeholder=\"Title\" ng-model=\"blog.title\">\r\n            </div>\r\n        </div>\r\n    </form>\r\n\r\n    <div class=\"col-lg-12 col-md-12 col-sm-12 col-xs-12\">\r\n        <toggle-switch ng-model=\"editMode\" knob-label=\"Edit\"></toggle-switch>\r\n        <div class=\"pull-right\">\r\n            <i class=\"fa fa-undo\" ng-click=\"revertEdit()\"></i>\r\n            <i class=\"fa fa-remove\" ng-click=\"deleteBlog()\"></i>\r\n            <i class=\"fa fa-save\" ng-click=\"saveBlog()\"></i>\r\n        </div>\r\n    </div>\r\n\r\n    <div class=\"col-lg-12 col-md-12 col-sm-12 col-xs-12\">\r\n        <div class=\"row\">\r\n            <div class=\"col-lg-12 col-md-12 col-sm-12 col-xs-12\">\r\n                <ui-select multiple tagging tagging-label=\"(New Tag)\" ng-model=\"blog.tags\" theme=\"bootstrap\" ng-disabled=\"disabled\" style=\"width: 300px;\">\r\n                    <ui-select-match placeholder=\"Select tag\">{{$item}}</ui-select-match>\r\n                    <ui-select-choices repeat=\"tag in tags | filter:$select.search\">\r\n                        <div ng-bind-html=\"tag | highlight: $select.search\"></div>\r\n                    </ui-select-choices>\r\n                </ui-select>\r\n            </div>\r\n        </div>\r\n\r\n        <div class=\"row\">\r\n            <div class=\"col-lg-12 col-md-12 col-sm-12 col-xs-12\" ng-if=\"editMode\">\r\n                <textarea class=\"input-block-level\" ng-model=\"blog.post\"></textarea>\r\n            </div>\r\n\r\n            <div class=\"col-lg-12 col-md-12 col-sm-12 col-xs-12\" ng-if=\"!editMode\" post=\"blog.post\"></div>\r\n        </div>\r\n    </div>\r\n\r\n</div>");}]);