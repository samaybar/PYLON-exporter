'use strict';

if(process.env.NODE_ENV === undefined){
    process.env.NODE_ENV = "basic";
}

var log = require('./utils/logger')
    , taskManager = require('./lib/taskManager')
    , OperationsEngine = require('./lib/OperationsEngine')
    , converter = require("./utils/jsonToCsv")
    , fw = require("./utils/fileWriter")
    ;

log.info("Using config file: " + process.env.NODE_ENV);

var oe = new OperationsEngine();
var configTasks = taskManager.buildFromConfig();

oe.process(configTasks, function(err, data, task){
    if(err){
        log.error(err);
    } else {
        log.info("NAME: " + JSON.stringify(task.name));

        converter.jsonToCsv(data)
        .then(function (nextData){
            fw.write(task.name, nextData);
            log.info(nextData);
        })
        .catch(function (finalErr) {
            log.error(finalErr);
        });

    }
});

