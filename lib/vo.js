/**
 * Created by sumedas on 13-Jul-15.
 */

// This file contains VOs (Value Objects) akin to what one would find in a typical Java project

function Post (pPost)
{
    this.title = pPost.title;

    if (!this.title || typeof this.title !== 'string')
    {
        this.title = '';
    }

    this['published-date'] = pPost['published-date'];

    if (!this['published-date'] || !(this['published-date'] instanceof Date))
    {
        this['published-date'] = new Date();
    }

    this.tags = pPost.tags;

    if (!this.tags || !(this.tags instanceof Array) )
    {
        this.tags = [];
    }

    this.keywords = pPost.keywords;

    if (!this.keywords || !(this.keywords instanceof Array) )
    {
        this.keywords = [];
    }

    function caseInsensitive (pQuery)
    {
        if (!pQuery || typeof pQuery !== 'string')
        {
            return false;
        }

        return function (pElement)
        {
            if (-1 !== pElement.toLowerCase().indexOf(pQuery.toLowerCase()))
            {
                return true;
            }
        };
    }

    this.containsQuery = function (pQuery) {
                                             pQuery = (!pQuery || typeof pQuery !== 'string') ? '' : pQuery;
                                             return this.tags.some(caseInsensitive(pQuery))      ||
                                                    this.keywords.some(caseInsensitive(pQuery))  ||
                                                    ( -1 !== this.title.toLowerCase().indexOf(pQuery.toLowerCase()) );
                                           };
}

/**
 * This might not be the best place to keep custom errors but for now I'll keep them here
 * @param pMessage Message to be displayed
 * @constructor
 */
// http://stackoverflow.com/questions/783818/how-do-i-create-a-custom-error-in-javascript
function MeowError (pMessage) {
    this.name = 'MeowError';
    this.message = (pMessage || "");
}

MeowError.prototype = Error.prototype;

function MeowApiError (pMessage) {
    this.name = 'MeowApiError';
    this.message = (pMessage || "");
}

MeowApiError.prototype = Error.prototype;

module.exports = {
    Post: Post,
    MeowError: MeowError,
    MeowApiError: MeowApiError
};