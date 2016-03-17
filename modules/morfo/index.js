var sleep = require('sleep');
var Curl = require('node-libcurl').Curl;
var querystring = require('querystring');
var S = require('string');
var xmlString = require('xml2js').parseString;
var urlAdject = 'http://api.morpher.ru/WebService.asmx/GetAdjectiveGenders',
  urlSimple = 'http://api.morpher.ru/WebService.asmx/GetXml';
var clientId;
var requests = {
  words: 0,
  count: 0,
  percent: 0
};
var morfoResult = {};
var step = 1;
var started = false;

var clearData = function () {
  requests = {
    words: 0,
    count: 0,
    percent: 0
  };
  morfoResult = {};
  step = 1;
};

var setOptions = function (word) {
  var isPrilag = (
    S(word).endsWith('ый')
    || (S(word).endsWith('ий') && word !== 'муфтий')
    || S(word).endsWith('ой')
    || S(word).endsWith('ая')
    || S(word).endsWith('ое')
  );
  return {
    'url': (isPrilag ? urlAdject : urlSimple),
    'word': word,
    'isPrilag': isPrilag
  };
};

var getRequest = function (opts, socket) {
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
    xmlString(body, function (err, res) {
      // console.info('curl:end', [err, res.xml]);
      if (res.xml) {
        res.xml['И'] = opts.word;
        compile(opts.word, createObject(res.xml, opts.isPrilag), socket);
        requests.count++;
        sleep.usleep(10000);
      }
    });
    close();
  });
  curl.on('error', curl.close.bind(curl));

  curl.perform();
};

var createObject = function (data, isPrilag) {
  if (data) {
    var tmp = {};
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
    if (!isPrilag) {
      tmp['Род'] = data['род'][0];
    }
      tmp['Прилагательное'] = isPrilag;
    return tmp;
  }
  return {};
};

var compile = function (word, obj, socket) {
  morfoResult[word] = obj;
  // console.info('compile', morfoResult);
  progress(socket);
};

var processing = function (data, socket) {
  for (var i = 0; i < data.length; i++) {
    // console.info('processing', data[i]);
    getRequest(setOptions(data[i]), socket);
    requests.words = i + 1;
    requests.percent += step;
  }
};

var progress = function (socket) {
  if (requests.percent < 100) {
    requests.percent++;
    console.log('progressed', requests.percent);
    socket.emit('progress', requests);
  } else {
    // if (started) {
    //   requests.percent = 100;
    //   // console.info('progress done', [requests, morfoResult]);
    //   //.sort()
    //   socket.emit('progress done', res);
    // }
    // started = false;
    socket.emit('progress done', {});
  }
};

var startProgress = function (socket, data) {
  if (data.length && !started) {
    clearData();
    started = true;
    step = 100 / data.length;
    requests.percent = step;
    console.info('progress', requests);
    socket.emit('progress', requests);
    processing(data, socket);
  }
};

var morfo = function (io) {
  io.on('connection', function (socket) {
    clientId = socket.client.id;
    console.info('user connected');
    socket.emit('connected', clientId);
    socket.on('disconnect', function () {
      console.info('user disconnected');
      socket.emit('disconnected', clientId);
    });
    socket.on('start progress', function (data, cb) {
      var sData = S(data).trim().s;
      if (sData.length) {
        cb();
        console.info('start progress');
        startProgress(socket, data.split('\n'));
      }
    });
    socket.on('progressed', function () {
      progress(socket);
    });
    socket.on('end progress', function () {
      console.info('end progress');
      started = false;
      var res = {},
        keys = Object.keys(morfoResult),
        i, len = keys.length;

      keys.sort();

      for (i = 0; i < len; i++) {
        k = keys[i];
        res[k] = morfoResult[k];
      }
      socket.emit('end progress', res);
    });
  });
};

module.exports = morfo;
