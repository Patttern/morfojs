var async = require('async');
var Curl = require('node-libcurl').Curl;
var S = require('string');
var querystring = require('querystring');
var xmlString = require('xml2js').parseString;
var urlAdjective = 'http://api.morpher.ru/WebService.asmx/GetAdjectiveGenders',
  urlNoun = 'http://api.morpher.ru/WebService.asmx/GetXml';
var limit = 3;
var sessData = {};

var createSessObject = function (clientId, socket) {
  return {
    id: clientId,
    stats: {
      words: {
        all: 0,
        current: 0
      },
      requests: {
        all: 0,
        current: 0
      },
      percent: 0
    },
    result: {},
    step: 1,
    started: false,
    tasks: {},
    adjTasks: {},
    socket: socket
  };
};

var createSessData = function (socket) {
  var id = socket.client.id;
  sessData[id] = createSessObject(id, socket);
};

var processing = function (word, cId, isAdj, cb) {
  if (isAdj) {
    return function (err, res) {
      // console.log('adj:curl:end', [err, res]);
      sessData[cId].stats.requests.current++;
      if (err) cb(err, null);
      if (res.AdjectiveGenders) {
        var addonTasks = {};
        addonTasks[word] = createTask(word, cId);
        sessData[cId].stats.requests.all++;
        for (var i in res.AdjectiveGenders) {
          if (i == '$' || i == 'plural') continue;
          if (res.AdjectiveGenders[i].length) {
            var adjWord = res.AdjectiveGenders[i][0];
            // console.log('adj parse', [i, adjWord]);
            addonTasks[adjWord] = createTask(adjWord, cId);
            sessData[cId].stats.requests.all++;
          }
        }
        // console.log('addonTasks', addonTasks);
        async.parallel(addonTasks, function (aErr, aRes) {
          // console.log('adj addon end', [aErr, aRes]);
          if (aErr) cb(aErr, null);
          var adjRes = {
            'Прилагательное': true
          };
          for (var i in aRes) {
            var rode = aRes[i]['Род'];
            if (rode == 'Мужской') {
              adjRes['Множественное'] = new Object(aRes[i]['Множественное']);
            }
            adjRes[rode] = new Object(aRes[i][rode]);
          }
          cb(null, adjRes);
        });
      } else {
        cb(null, null);
      }
    };
  } else {
    return function (err, res) {
      // console.log('noun:curl:end', [err, res]);
      sessData[cId].stats.requests.current++;
      if (err) cb(err, null);
      if (res.xml) {
        res.xml['И'] = word;
        var obj = createObject(res.xml, isAdjective(word));
        cb(null, obj);
      }
    };
  }
};

var createTask = function (word, cId, isAdj) {
  return function (cb) {
    // console.log('start task', word);
    var opts = setOptions(word, isAdj);
    var curl = new Curl();
    var close = curl.close.bind(curl);
    curl.setOpt(Curl.option.URL, opts.url);
    curl.setOpt(Curl.option.FAILONERROR, true);
    curl.setOpt(Curl.option.FOLLOWLOCATION, true);
    curl.setOpt(Curl.option.POSTFIELDS, querystring.stringify({
      's': opts.word,
      'username': 'vasya',
      'password': 'secret'
    }));

    curl.on('end', function(statusCode, body, headers) {
      xmlString(body, processing(word, cId, isAdj, cb));
      sessData[cId].stats.percent += sessData[cId].step;
      close();
    });
    curl.on('error', curl.close.bind(curl));

    curl.perform();
  };
};

var isAdjective = function (word) {
  return (
    S(word).endsWith('ый')
    || (S(word).endsWith('ий') && word !== 'муфтий')
    || S(word).endsWith('ой')
    || S(word).endsWith('ая')
    || S(word).endsWith('ое')
  );
};

var setOptions = function (word, isAdj) {
  return {
    'url': (isAdj ? urlAdjective : urlNoun),
    'word': word
  };
};

var createObject = function (data, isAdj) {
  // console.log('createObject', [isAdj, data]);
  if (data) {
    var tmp = {};
    if (isAdj) {

    }
    if (data['род'] && data['род'].length) {
      tmp[data['род']] = {
        'И': data['И'],
        'Р': data['Р'][0],
        'Д': data['Д'][0],
        'В': data['В'][0],
        'Т': data['Т'][0],
        'П': data['П'][0]
      };
    }
    if (data['множественное'] && data['множественное'].length) {
      tmp['Множественное'] = {};
      for (var i in data['множественное'][0]) {
        if (i === 'П-о') continue;
        tmp['Множественное'][i] = data['множественное'][0][i][0];
      }
    }
    tmp['Род'] = data['род'][0];
    tmp['Прилагательное'] = isAdj;
    return tmp;
  }
  return {};
};

var callbackResult = function (clientId) {
  return function (err, res) {
    var keys = Object.keys(res);
    keys.sort();
    // console.info('callbackResult', keys);
    for (var i in keys) {
      sessData[clientId].result[i] = res[i];
    }
    sessData[clientId].result = res;
    sessData[clientId].socket.emit('progress done');
  };
};

var run = function (clientId, listWords) {
  sessData[clientId].started = true;
  var len = Object.keys(sessData[clientId].tasks).length;
  sessData[clientId].stats.words.all = len;
  sessData[clientId].stats.requests.all = len;
  sessData[clientId].step = 100 / len;
  async.parallelLimit(sessData[clientId].tasks, limit, callbackResult(clientId));
};

var morfo = function (io) {
  io.on('connection', function (socket) {
    var cId = socket.client.id;
    console.info('connected');
    socket.emit('connected');
    socket.on('disconnect', function () {
      console.info('disconnected');
      socket.emit('disconnected');
    });
    socket.on('start progress', function (data, cb) {
      createSessData(socket);
      var sData = S(data).trim().s;
      if (sData.length) {
        cb();
        var listWords = sData.split('\n');
        for (var w in listWords) {
          var word = S(listWords[w]).trim().s;
          var isAdj = isAdjective(word);
          sessData[cId].tasks[word] = createTask(word, cId, isAdj);
        }
        // console.info('start progress');
        socket.emit('progress', sessData[cId].stats);
        run(cId);
      }
    });
    socket.on('progressed', function () {
      if (sessData[cId].started) {
        // console.info('progressed');
        socket.emit('progress', sessData[cId].stats);
      }
    });
    socket.on('end progress', function () {
      // console.info('end progress', sessData[cId].result);
      socket.emit('end progress', sessData[cId].result);
      sessData[cId].started = false;
    });
  });
};

module.exports = morfo;
