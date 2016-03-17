var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var assets = __dirname + '/assets';

app.use(express.static('assets'));

app.get('/', function(req, res){
  res.sendFile(assets + '/index.html');
});

require('./modules/morfo')(io);

http.listen(3000, function(){
  console.log('listening on *:3000');
});

