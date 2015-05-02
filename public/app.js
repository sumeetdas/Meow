/**
 * Created by sumedas on 29-Mar-15.
 */
angular
    .module('app', ['meow.blog.edit'])
    .config(['$urlRouterProvider', function ($urlRouterProvider) {
        $urlRouterProvider
            .otherwise('/blogs');
    }])
    .run(['$blogEdit', function ($blogEdit) {
        // $blogView.setUserName('Sumeet Das');
        $blogEdit.setBlogsPerPage(5);
    }]);