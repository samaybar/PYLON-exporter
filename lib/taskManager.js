'use strict';

var config = require('config')
    , moment = require('moment')
    , _ = require('lodash')
    , operator = require("../utils/operator")
    , configLoader = require("../utils/configLoader")
    , log = require("../utils/logger")
    ;

var mergeCache = require('./mergeCache');

/**
 * getDefaults - get default request parameters
 *
 * @returns {obj}
 */
var getDefaultTaskObj = function getDefaults() {

    var start = moment.utc().subtract(32, 'days').unix();
    var end = moment.utc().unix();

    if (config.has('start')) {
        start = config.get('start');
    }
    if (config.has('end')) {
        end = config.get('end');
    }
    return _.cloneDeep({
        'method': 'POST',
        'auth': {
            'user': config.get('auth.username'),
            'pass': config.get('auth.api_key')
        },
        'uri': 'https://api.datasift.com/v1/pylon/analyze',
        'json': {
            'hash': config.get('hash'),
            'start': start,
            'end': end,
            'parameters': {
                'analysis_type': 'freqDist',
                'parameters': {}
            }
        }
    });
};

/**
 * _addTaskParams - process each of the task parameters
 * and add them to the request object config
 *
 * @param reqParams - obj
 * @param tasks - obj
 *
 * @returns {*}
 * @private
 */
var _addTaskParams = function _addTaskParams(reqParams, task) {
    for (var taskProp in task) {
        

        if (task.hasOwnProperty(taskProp)) {
            // dont add unsupported properties
            var ignoreProps = ["id,child,runonly"];
            if(ignoreProps.indexOf(taskProp) !== -1){
                continue;
            }
            //copy the 'then' object to params
            if (taskProp === 'then') {
                reqParams.then =
                    task.then;
            } 
            else {
                //start & end
                if (taskProp === 'start' || taskProp === 'end'){
                    reqParams.json[taskProp] = task[taskProp];
                }
                
                //write all other props to params
                reqParams.json.parameters.parameters[taskProp] =
                    task[taskProp];
            }
        }
    }
    //debug note
    log.debug("reqParams: " + JSON.stringify(reqParams, null, 2));
    return reqParams;
};

/**
 * _getName - build a name property based on
 * available task properties
 *
 * @param obj - task object
 * @returns {string}
 * @private
 */
var _getName = function _getName(obj){
    if(obj.name){
        return obj.name;
    }
    if(obj.target && obj.then && obj.then.target){
        return obj.target + "-THEN-" + obj.then.target;
    }
    if(obj.interval && obj.then && obj.then.target){
        return obj.interval + "-THEN-" + obj.then.target;
    }
    if(obj.target && obj.filter){
        return obj.target + "--" + obj.filter;
    }
    if(obj.target && !obj.filter){
        return obj.target;
    }
    //timeSeries
    if(!obj.target && !obj.filter && obj.interval && obj.span){
        return obj.interval + "--span_" + obj.span;
    }
    if(!obj.target && obj.filter && obj.interval){
        return obj.filter + "--span_" + obj.interval;
    }
    return "not specified";
};

/**
 * _processNativeNested
 *
 * @param taskType - string - always "freqDist"
 * @param eachTask - task object derived from config
 * @returns {Array}
 * @private
 */
var _processNativeNested = function _processNativeNested(taskType, eachTask){
    var out = [];
    var reqParams = getDefaultTaskObj();

    reqParams.json.parameters.analysis_type = taskType;
    reqParams.name = _getName(eachTask);
    delete (eachTask.name);

    //is there a master filter
    if (config.has('filter')) {
            log.debug("There is a master filter");
            var masterFilter = config.get('filter');
            //combine master and config filter
            if(eachTask.filter) {
                log.debug("There is a master filter and a config filter");
                reqParams.json.filter = "(" + masterFilter + ") and (" + eachTask.filter + ")";
                delete (eachTask.filter);
            }
            //apply only master
            else {
                log.debug("There is only a master filter");
                reqParams.json.filter = masterFilter;
            }
        }

    else if (eachTask.filter) {
        log.debug("There is only a config filter");
        reqParams.json.filter = eachTask.filter;
        delete (eachTask.filter);
    }

    // do we have a nested nested?
    var grandChild = eachTask.child.child || undefined;

    if (grandChild) {
        delete (eachTask.child.child);
    }

    if (eachTask.child) {
        reqParams.json.parameters.child = {};
        reqParams.json.parameters.child.analysis_type = taskType;
        reqParams.json.parameters.child.parameters = eachTask.child;

         if (grandChild) {
             reqParams.json.parameters.child.child = {};
             reqParams.json.parameters.child.child.analysis_type = taskType;
             reqParams.json.parameters.child.child.parameters = grandChild;
         }
        delete (eachTask.child);
    }
    reqParams = _addTaskParams(reqParams, eachTask);
    out.push(reqParams);
    //log.info(JSON.stringify(allTasks, null, 4));
    return out;
};



/**
 * _processTask - process a non-merged task
 *
 * @param taskType - string - freqDist or timeSeries
 * @param eachTask - obj - the task object
 * @returns {Array}
 * @private
 */
var _processTask = function _processTask(taskType, eachTask){
    var out = [];
    var reqParams = getDefaultTaskObj();

    // type
    reqParams.json.parameters.analysis_type = taskType;
    delete (eachTask.type);

    // name property
    reqParams.name = _getName(eachTask);
    delete (eachTask.name);

    //is there a master filter
    if (config.has('filter')) {
            log.debug("There is a master filter");
            var masterFilter = config.get('filter');
            //combine master and config filter
            if(eachTask.filter) {
                log.debug("There is a master filter and a config filter");
                reqParams.json.filter = "(" + masterFilter + ") and (" + eachTask.filter + ")";
                delete (eachTask.filter);
            }
            //apply only master
            else {
                log.debug("There is only a master filter");
                reqParams.json.filter = masterFilter;
            }
        }

    else if (eachTask.filter) {
        log.debug("There is only a config filter");
        reqParams.json.filter = eachTask.filter;
        delete (eachTask.filter);
    }

    reqParams = _addTaskParams(reqParams, eachTask);
    out.push(reqParams);
    return out;
};

/**
 * _processMergedTask - process a merged task
 *
 * @param taskType - string - freqDist or timeSeries
 * @param name - string - the name of the task
 * @param mergeObject - obj - the merge task object
 * @returns {Array}
 * @private
 */
var __processMerged = function __processMerged(taskType, name, mergeObject){
    var out = [];
    var cacheId = mergeCache.create();
    for (var mergeTasks in mergeObject[name]) {
        if (mergeObject[name].hasOwnProperty(mergeTasks)) {
            //shorten
            var eachTask = mergeObject[name][mergeTasks];
            var reqParams = getDefaultTaskObj();
            reqParams.name = name;
            reqParams.json.parameters.analysis_type = taskType;

            //merge key
            var mergeKey;
            if(eachTask.id){
                mergeKey = eachTask.id;
            } else if(eachTask.target && eachTask.filter){
                mergeKey = eachTask.target + "_" + eachTask.filter;
            } else if(eachTask.target && !eachTask.filter){
                mergeKey = eachTask.target;
            } else if(eachTask.interval && eachTask.filter){
                mergeKey = eachTask.interval + "_" + eachTask.filter;
            }

            delete (eachTask.id);

            //filter property
            //is there a master filter
            if (config.has('filter')) {
                    log.debug("There is a master filter");
                    var masterFilter = config.get('filter');
                    //combine master and config filter
                    if(eachTask.filter) {
                        log.debug("There is a master filter and a config filter");
                        reqParams.json.filter = "(" + masterFilter + ") and (" + eachTask.filter + ")";
                        delete (eachTask.filter);
                    }
                    //apply only master
                    else {
                        log.debug("There is only a master filter");
                        reqParams.json.filter = masterFilter;
                    }
                }

            else if (eachTask.filter) {
                log.debug("There is only a config filter");
                reqParams.json.filter = eachTask.filter;
                delete (eachTask.filter);
            }

            reqParams = _addTaskParams(reqParams, eachTask);

            if (mergeCache.addKey(cacheId, mergeKey) === false) {
                return [];
            }

            //attach a cache signature to the request
            reqParams.cache = {
                "cacheId": cacheId,
                "mergeKey": mergeKey
            };
            out.push(reqParams);
        }
    }
    return out;
};

/**
 * buildFromConfig - iterate config file and build
 * array of request objects based on task type.
 *
 * Tasks will be one of three formats.
 *
 * Merged queries (__processMerged):
 *
 *  {
 *    "task name": [
 *      {
 *        //task 1...
 *      },
 *      {
 *        //task 2...
 *      }
 *    ]
 *  }
 *
 * or not nested (_processTask):
 *
 *  {
 *     //task 1...
 *  },
 *  {
 *     //task 2...
 *  },
 *
 *
 * @param (Obj) - tasks object read from config
 * @returns {Array} - array of request objects
 */
var buildFromConfig = function buildFromConfig(tasks) {

    tasks = tasks || configLoader.load();
    var allTasks = []
        ;

    function getType(obj) {
        return Object.prototype.toString.call(obj);
    }

    //merge array of objects
    function appendAll(dest, src) {
        var n;
        for (n = 0; n < src.length; ++n) {
            dest.push(src[n]);
        }
        return dest;
    }

    //check to see if runonly
    var isRunonly = false;
    if (config.has('runonly')) {
        isRunonly = config.get('runonly');
    }

    // taskType - freqDist or timeSeries
    for (var taskType in tasks) {
        //each task
        for (var task in tasks[taskType]) {
            
            //shorten
            var eachTask = tasks[taskType][task];
            //inspect the first key value to identify if
            //it is a merged object task
            var firstTaskKey = Object.keys(eachTask)[0];
            var firstTaskValue = eachTask[Object.keys(eachTask)[0]];
            var firstKeyValueType = getType(firstTaskValue);
            //is this task set to run
            var eachTaskIsRunonly = false;
            if (eachTask.hasOwnProperty('runonly')) {
                eachTaskIsRunonly = eachTask.runonly;
                delete (eachTask.runonly);
            }
            //if runonly is selected, run only selected tasks
            if ((isRunonly && eachTaskIsRunonly) || (!isRunonly)) {

                if(firstKeyValueType === "[object Array]"){
                    appendAll(allTasks, __processMerged(taskType,
                        firstTaskKey, eachTask));
                } else if(eachTask.child){
                    appendAll(allTasks, _processNativeNested("freqDist"
                        , eachTask));
                } else {
                    appendAll(allTasks, _processTask(taskType, eachTask));
                }
            }
        }
    }
    //log.info(JSON.stringify(allTasks, null, 4));
    return allTasks;
};

/**
 * _generateEndTs - generate end timeStamp based on
 * a given start TS and interval string e.g. week
 *
 * @param start - int - unix ts
 * @param interval - string
 * @returns {number} - unix ts
 */
var _generateEndTs = function _generateEndTs(start, interval){
    switch (interval) {
        case "minute":
            return start + 60 -1;
        case "hour":
            return start + (60 * 60 -1);
        case "day":
            return start + (60 * 60 * 24 -1);
        case "week":
            return start + (60 * 60 * 24 * 7 -1);
        case "month":
            return start + (60 * 60 * 24 * 30 -1);
        default:
            return start + (60 * 60 * 24 * 30 -1);
    }
};

/**
 * buildFromResponse - build request options obj from
 * the PYLON response.
 *
 * @param data
 * @param task - containing then object
 * @returns - array of request objects
 */
var buildFromResponse = function buildFromResponse(data, task) {
    if(data && data.error){ return []; }

    var secondaryTasks = []
        , results = data.analysis.results || {}
        , resultTarget = data.analysis.parameters.target || undefined
        , cacheId = mergeCache.create() // create cache record
        , then = task.then // obj containing the next task
        , type = "freqDist"
        ;

    //then.type set?
    if(then && then.type){
        type = then.type;
        delete (then.type);
    }

    //process result keys and build the secondary task obj
    for (var ind in results) {
        if (results.hasOwnProperty(ind)) {

            var reqParams = getDefaultTaskObj() //new req params obj
                , configFilter = ""
                ;

            //name property
            reqParams.name = task.name;

            //type property
            reqParams.json.parameters.analysis_type = type;

            //iterate the then params and push to the new req obj
            for (var thenInd in then) {
                if (then.hasOwnProperty(thenInd)) {

                    //is there a master filter
                    if (config.has('filter')) {
                        log.debug("There is a master filter");
                        var masterFilter = config.get('filter');
                        /*if(then.filter){
                            configFilter = "(" + masterFilter + ") and (" + then.filter + ") AND ";
                        }
                        else {*/
                        configFilter = "(" + masterFilter + ") AND ";
                        log.debug("configFilter: " + configFilter);  
                    }
                    
                    if(then.filter){
                        configFilter = configFilter + "(" + then.filter + ") AND ";
                        log.debug("configFilter: " + configFilter);
                    }

                    reqParams.json.parameters.parameters[thenInd]
                            = then[thenInd];
                }
            }
            delete (reqParams.json.parameters.parameters.filter);

            //build secondary filter param
            if(resultTarget){
                reqParams.json.filter = configFilter + resultTarget + " "
                    + operator.get(resultTarget) + '"' + results[ind].key + '"';
            } else {
                //no target, must be a timeSeries (freqDist with an overridden child type)
                var startOverride = results[ind].key;
                var endOverride = _generateEndTs(startOverride, data.analysis.parameters.interval);
                //is there a master filter
                if (config.has('filter')) {
                    log.debug("time series with master filter");
                    var masterFilter = config.get('filter');
                    reqParams.json.filter = masterFilter;
                }

                //only override the start if its less than 32 days as timeSeries can
                //return an interval start outside of the max period. If that happens
                //the default obj value will be used ie now - 32 days
                if(startOverride > moment.utc().subtract(32, 'days').unix()){
                    reqParams.json.start = startOverride;
                }
                reqParams.json.end = endOverride;

                log.debug("Start: " + reqParams.json.start +
                    " " + moment.unix(reqParams.json.start).utc().format("DD-MMM h:mm:ss a"));
                log.debug("End:   " + reqParams.json.end
                    + " " + moment.unix(reqParams.json.end).utc().format("DD-MMM h:mm:ss a"));
            }

            //cache the merge key
            mergeCache.addKey(cacheId, results[ind].key);

            //attach a signature to the request
            reqParams.cache = {
                "cacheId": cacheId,
                "mergeKey": results[ind].key
            };
            //log.info(JSON.stringify(reqParams, null, 4));
            secondaryTasks.push(reqParams);
        }
    }
    return secondaryTasks;
};

exports.getDefaultTaskObj = getDefaultTaskObj;
exports.buildFromConfig = buildFromConfig;
exports.buildFromResponse = buildFromResponse;
