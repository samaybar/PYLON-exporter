"use strict";
process.env.NODE_ENV = 'test';

var chai = require("chai")
    ;

var expect = chai.expect
    ;

var taskManager = require('../../../../lib/taskManager')
    ;

var resData = {
    analysis: {
        "analysis_type": "freqDist",
        "parameters": {
            "target": "fb.parent.author.gender",
            "threshold": 2
        },
        "results": [
            {
                "key": "male",
                "interactions": 67722,
                "unique_authors": 50700
            },
            {
                "key": "female",
                "interactions": 49331,
                "unique_authors": 38600
            }
        ],
        "redacted": false
    }
};

var task = {
    "then": {
        "target": "fb.parent.author.age",
        "threshold": 3
    }
};

describe("Task Manager buildFromResponse - freqDist", function(){

    it("should build a task array from a response", function(){
        var reqOptions = taskManager.buildFromResponse(resData, task);
        reqOptions.should.be.an('array');
        reqOptions.should.have.length(2);
        for (var ind in reqOptions) {
            expect(reqOptions[ind]).
                to.have.keys("auth", "cache", "name", "json", "method", "uri");
        }
    });

    it("should have built the correct filter from results", function(){
        var reqOptions = taskManager.buildFromResponse(resData, task);
        reqOptions[0].json.filter.
            should.equal("fb.parent.author.gender ==\"male\"");

        reqOptions[1].json.filter.
            should.equal("fb.parent.author.gender ==\"female\"");
    });

    it("should have built the correct type from results", function(){
        var reqOptions = taskManager.buildFromResponse(resData, task);
        reqOptions[0].json.parameters.analysis_type.should.equal('freqDist');
        reqOptions[1].json.parameters.analysis_type.should.equal('freqDist');
    });

    it("should have built the correct props for a timeSeries", function(){
        task.then = {
            "type": "timeSeries",
            "interval": "week",
            "span": 2
        };

        var reqOptions = taskManager.buildFromResponse(resData, task);

        reqOptions[0].json.parameters.analysis_type.should.equal('timeSeries');
        reqOptions[0].json.parameters.parameters.interval.should.equal('week');
        reqOptions[0].json.parameters.parameters.span.should.equal(2);

        reqOptions[1].json.parameters.analysis_type.should.equal('timeSeries');
        reqOptions[1].json.parameters.parameters.interval.should.equal('week');
        reqOptions[1].json.parameters.parameters.span.should.equal(2);
    });

    it("should create objects with a cache signature", function(){
        var reqOptions = taskManager.buildFromResponse(resData, task);
        for (var ind in reqOptions) {
            expect(reqOptions[ind].cache.cacheId.should.be.a('string'));
            expect(reqOptions[ind].cache.cacheId.should.have.length(36));
        }
        reqOptions[0].cache.mergeKey.should.equal('male');
        reqOptions[1].cache.mergeKey.should.equal('female');

        expect(reqOptions[0].cache.cacheId).
            to.equal(reqOptions[1].cache.cacheId);
    });

});
