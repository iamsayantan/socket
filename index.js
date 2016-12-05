var io = require('socket.io');
var socket = io.listen(3000, '127.0.0.1');

// all the people that have joined the chat
var people = {};

socket.on('connection', function (client) {
    console.log('An user connected');
    client.on('join', function(name) {
        people[client.id] = name;

        // client.emit() will only update the client that you are looking
        // at, whereas socket.sockets.emti() will update all connected clients
        client.emit('update', 'You have successfully connected..');
        socket.sockets.emit('update', name + " has joined the conversation..");
        socket.sockets.emit('update-people', people);
    });

    client.on('send', function(msg){
        socket.sockets.emit('chat', people[client.id], msg);
    });

    client.on('disconnect', function() {
        socket.sockets.emit('update', people[client.id] + ' has left the conversation..');
        delete people[client.id];
        socket.sockets.emit('update-people', people);
    });

});
