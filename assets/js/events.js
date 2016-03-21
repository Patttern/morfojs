$(function () {
  $('#progress').hide();
  $('#submit').attr('disabled','disabled');
  var socket = io();
  $('#submit').click(function () {
    socket.emit('start progress', $('#data').val(), function () {
      $('#data').attr('disabled','disabled');
      $('#submit').attr('disabled','disabled');
      $('#progress').show();
    });
  });
  socket.on('connected', function () {
    $('#submit').removeAttr('disabled');
  });
  socket.on('disconnected', function () {
    $('#submit').attr('disabled','disabled');
  });
  socket.on('progress', function (req) {
    // console.log('progress', req.percent);
    var prc = parseInt(req.percent, 10) || 0;
    $('#wordsCur').text(req.words.current);
    $('#wordsAll').text(req.words.all);
    $('#reqCur').text(req.requests.current);
    $('#reqAll').text(req.requests.all);
    $('#progress div').text(prc + '%').width(prc + '%');
    socket.emit('progressed');
  });
  socket.on('progress done', function (data) {
    socket.emit('end progress');
  });
  socket.on('end progress', function (data) {
    $('#progress div').text('100%').width('99.4%');
    $('#data').removeAttr('disabled');
    $('#submit').removeAttr('disabled');
    // console.log(data);
    processing(data);
  });

  function processing (data) {
    var simpleTable = $('<table/>');
    var diffTable = $('<table/>');
    simpleHeaders(simpleTable);
    diffHeaders(diffTable);
    for (var word in data) {
      var wdata = data[word];
      // console.log([word, wdata]);
      var inserted = false;
      // console.log(wdata["Прилагательное"]);
      if (wdata && wdata["Прилагательное"]) {
        var rodes = ['Мужской', 'Женский', 'Средний', 'Множественное'];
        for (var rode in rodes) {
          var r = rodes[rode];
          var tr = $('<tr/>');
          if (!inserted) {
            tr.append($('<td/>').append(word));
            inserted = true;
          } else {
            tr.append($('<td/>').append(''));
          }
          var pdata = wdata[r];
          // console.log([r, pdata, wdata]);
          tr.append($('<td/>').append(r));
          appendTr(tr, 'td', pdata);
          diffTable.append(tr);
        }
        $('#container2').empty().append(diffTable);
      } else {
        // console.log([wdata['Род'], wdata['Род'].length, word, wdata]);
        var tr = $('<tr/>');
        if (wdata && wdata['Род'].length) {
          tr.append($('<td/>').append(word))
            .append($('<td/>').append(wdata['Род']));
          appendTr(tr, 'td', wdata[wdata['Род']]);
          appendTr(tr, 'td', wdata['Множественное']);
        } else {
          tr.append($('<td/>').append(word))
            .append($('<td/>').append(''));
          appendTr(tr, 'td', '');
        }
        $('#container1').empty().append(simpleTable.append(tr));
      }
    }
  }

  function simpleHeaders (table) {
    var preth = $('<tr/>');
    preth.append($('<th/>').append(''))
      .append($('<th/>').append(''))
      .append($('<th/>').attr('colspan','6').append('Ед.ч.'))
      .append($('<th/>').attr('colspan','6').append('Мн.ч.'));
    table.append(preth);
    var th = $('<tr/>');
    th.append($('<th/>').append(''))
      .append($('<th/>').append('Род'));
    appendTr(th, 'th');
    appendTr(th, 'th');
    table.append(th);
  }

  function diffHeaders (table) {
    var th = $('<tr/>');
    th.append($('<th/>').append(''))
      .append($('<th/>').append('Род'));
    appendTr(th, 'th');
    table.append(th);
  }

  function appendTr (node, child, appender) {
    if (!node) return;
    var padeges = ['И', 'Р', 'Д', 'В', 'Т', 'П'];
    for (var p in padeges) {
      var padeg = padeges[p];
      if (appender === '') {
        padeg = '';
      } else if (typeof appender == 'object') {
        padeg = appender[padeges[p]];
      }
      node.append($('<' + child + '/>').append(padeg));
    }
  }
});
