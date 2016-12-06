var app = require('express')();
var http = require('http').Server(app);

var io = require('socket.io')(http);
// var socket = io.listen(3000, '127.0.0.1');

// all the people that have joined the chat
var people = {};

io.on('connection', function (client) {
    console.log('An user connected');
    client.on('join', function(name) {
        people[client.id] = name;
        // client.emit() will only update the client that you are looking
        // at, whereas socket.sockets.emti() will update all connected clients
        client.emit('update', 'You have successfully connected..');
        io.sockets.emit('update', name + " has joined the conversation..");
        io.sockets.emit('update-people', people);
    });

    client.on('send', function(msg){
        console.log(people[client.id] + ' Says: ' + msg);
        io.sockets.emit('chat', people[client.id], msg);
    });

    client.on('disconnect', function() {
        io.sockets.emit('update', people[client.id] + ' has left the conversation..');
        delete people[client.id];
        io.sockets.emit('update-people', people);
    });

});

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

http.listen(3000, function() {
    console.log('Listening on port 3000...');
})
