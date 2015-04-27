/**
 * Created by sumedas on 03-Apr-15.
 */

var express     = require('express'),
    engine      = require('./lib'),
    app         = express();

app.use('/public', express.static(__dirname + '/public'));

app.get('/', function (request, response) {
    response.sendFile(__dirname + '/public/index.html');
});

engine
    .config(function (pConfig) {
        pConfig.setConfig('jobs.cron.cronTime', '00 48 01 * * *');
    })
    .blog(app)
    .jobs(function (pJobs) {
        pJobs
            .startup()
            .then(function () {
                app.listen(5000, function () {
                    console.log('The server is running at port:5000');
                });
            });
    });
