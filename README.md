# PYLON-exporter

Utility for exporting data from a PYLON index. Features:
 
 * Inbuilt queue to support large numbers of simultaneous requests
 * Parallel requests limit to manage control flow
 * Nested requests - full support for all targets
 * Merging of related response data sets
 * Config inheritance


## Setup

If Node is not installed, install it from https://nodejs.org/. Once complete, check by running ```node -v``` from a 
terminal window to show the install version.

Install node module dependencies:

```sudo npm install```

Run tests:

```npm test```


## Usage


A JSON config file is used to define what data to request. Simply edit ```/config/defaults.js``` file to get started.

Execute:

```node app.js```


## Overwrite Config

Additional config files can be created that inherit the properties of the ```default.js`` file. This functionality is 
useful if multiple configurations are required.

NOTE: All config files extend ```defaults.js``` and hence anything specified there will be run in addition to 
anything specified in a custom configuration file.

**Example Config Recipe**

Create a new file within the ```/config/``` directory called `foo.js` with the following configuration:
 

```json
 "use strict";
 
 module.exports = {
     "analysis": {
         "freqDist": [
             {
                 "target": "fb.parent.author.gender",
                 "threshold": 2
             }
         ],
         "timeSeries": [
             {
                 "interval": "week",
                 "span": 1
             }
         ]
     }
 };
 
 ```

Next, set the config file using an environment variable:

```export NODE_ENV=foo```


When run, the ```default``` config file will be loaded, followed by the ```foo``` config file. ```Foo``` will 
overwrite any duplicate values within the ```default``` file.

### Merging Result Sets
Merging of response data is supported by defining the requests to be merged as an array. A ```name``` property can be
specified to identify each data set. If a ```name``` is not specified, the ```target``` will be used. If the 
```target``` is not specified (time series) or is a duplicate, the filter property will be used.

```json
[
    {
        "name": "ford",
        "filter": "fb.content contains \"ford\"",
        "interval": "week",
    },
    {
        "name": "honda",
        "filter": "fb.content contains \"honda\"",
        "interval": "week",
    }
]
```


### Nested Requests

Nested requests are supported whereby each result key from a primary request then automatically generates
a subsequent secondary request using the key as a ```filter``` parameter.

Nested requests are configured within the config file using the ```then``` object:

```json
{
    "target": "fb.parent.author.gender",
    "threshold": 2,
    "then": {
        "target": "fb.parent.author.age",
        "threshold": 6
    }
}
```

Nested requests automatically merge the result sets in to a single data set.


### Request Filters

The ```filter``` parameter is supported as expected.

```json
{
    "filter": "fb.parent.sentiment == \"negative\"",
    "target": "fb.parent.topics.name",
    "threshold": 2
}
```

**Nested Filters - Primary**

The ```filter``` property can also be used within nested queries:

```json
{
    "filter": "fb.sentiment == \"positive\"",
    "target": "links.domain",
    "threshold": 5,
    "then": {
        "target": "fb.parent.gender",
        "threshold": 2
    }
}
```
In this instance, the ```filter``` parameter is ***ONLY applied to the primary*** request, not the secondary requests. 
The first request would be made for the top 5 domains where the sentiment is positive. For each of the domains 
returned, a subsequent request is made for the gender. These ***secondary requests DO NOT include the filter*** for 
sentiment as it was only specified as part of the primary request.

**Nested Filters - Secondary**

Specifying a ```filter``` within a nested query results in the specified filter being appended to the automatically 
generated filters using an  ```AND`` operator. For example: 

```json
{
    "target": "fb.type",
    "threshold": 4,
    "then": {
        "filter": "fb.parent.author.gender == \"male\"",
        "target": "fb.parent.author.age",
        "threshold": 2
    }
}
```
This would generate the following request for each type:

```json
{
  "parameters": {
    "analysis_type": "freqDist",
    "parameters": {
      "target": "fb.parent.author.age",
      "threshold": 2
    }
  },
  "filter": "fb.parent.author.gender == \"male\" AND fb.type ==\"like\""
}
```

Of course both primary and secondary ```filter``` parameters can be used together. For example, if we wanted results
for Male authors only for both the primary request and secondary:

```json
{
    "target": "fb.type",
    "threshold": 4,
    "filter": "fb.parent.author.gender == \"male\"",
    "then": {
        "target": "fb.parent.topics.name",
        "threshold": 2
        "filter": "fb.parent.author.gender == \"male\"",
    }
}
```            

### TODO

https://github.com/haganbt/PYLON-exporter/issues
