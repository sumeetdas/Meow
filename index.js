/**
 * Created by sumedas on 03-Apr-15.
 */

var express     = require('express'),
    bodyParser  = require('body-parser'),
    config      = require('./lib/config'),
    app         = express();

config.setConfig('jobs.cron.cronTime', '00 48 01 * * *');
var jobs = require('./lib/jobs');

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());


require('./lib/blog')(app);

jobs
    .startup()
    .then(function () {
        app.listen(5000, function () {
            console.log('The server is running at port:5000');
        });
    });
