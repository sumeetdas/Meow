/**
 * Created by sumedas on 26-Mar-15.
 */

describe('meow-github tests', function() {

    var noBlogQuery = "downtown abbey 23412",
        threeBlogsQuery = "Edward Kemway",
        threeBlogs = ["edward kemway 12", "Edward-Kemway-14", "Edward Kemway 92"];

    beforeEach(function() {
        browser.get( host + '/')
    });

    it('should show edit icon against every blog in the right hand side', function() {

    });

    it('should have a search box', function() {

    });

    it('should show message "No blogs found" when searching for ' + noBlogQuery, function() {

    });

    it('should show First, Prev, Next, Last buttons at the end of the list in this order', function () {

    });

    it('should disable First, Prev, Next, Last buttons when blog list is empty', function () {

    });

    it('should disable First, Prev, Next, Last buttons when blog list contains 10 or less blogs', function () {

    });

    it('should disable First and Prev button when viewing first 10 blogs', function () {

    });

    it('should disable Last and Next button when viewing last 10 or less blogs', function () {

    });

    it('should enable First, Prev, Next and Last buttons when user is NOT viewing first or last search page results', function () {

    });

    it('should load at least 3 blogs when searching for ' + threeBlogsQuery, function () {

    });

    it('should load disqus, share and tags plugins', function () {

    });

});