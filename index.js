var app = require('express')();
var http = require('http').Server(app);
const bodyParser = require('body-parser');

/** bodyParser.urlencoded(options)
 * Parses the text as URL encoded data (which is how browsers tend to send form data from regular forms set to POST)
 * and exposes the resulting object (containing the keys and values) on req.body
 */
app.use(bodyParser.urlencoded({
    extended: true
}));

/**bodyParser.json(options)
 * Parses the text as JSON and exposes the resulting object on req.body.
 */
app.use(bodyParser.json());

// validation token for bot
const VALIDATION_TOKEN = 'myBot_validation_token';
const PAGE_ACCESS_TOKEN = 'EAAZAKO1ZBJHgYBAIdXkArrcVglfB9R3X27ZBk4hRo4m9MzwFhxFZCIsW17ptqprANFmbfEZCqxTWgrn1ArbQIKz5ZBthd1BKKA4IUYSUSZBNHN9dVTVZAqQNZCr7i363NMXwWgBi5dZCe1TSlVtPZCLWji0WdCKrJ9lgpF0NvtICnJZChQZDZD';

var io = require('socket.io')(http);
// var socket = io.listen(3000, '127.0.0.1');

// all the people that have joined the chat
var people = {};

io.on('connection', function(client) {
    console.log('An user connected');
    client.on('join', function(name) {
        people[client.id] = name;
        // client.emit() will only update the client that you are looking
        // at, whereas socket.sockets.emti() will update all connected clients
        client.emit('update', 'You have successfully connected..');
        io.sockets.emit('update', name + " has joined the conversation..");
        io.sockets.emit('update-people', people);
    });

    client.on('send', function(msg) {
        console.log(people[client.id] + ' Says: ' + msg);
        io.sockets.emit('chat', people[client.id], msg);
    });

    client.on('disconnect', function() {
        io.sockets.emit('update', people[client.id] + ' has left the conversation..');
        delete people[client.id];
        io.sockets.emit('update-people', people);
    });

});


app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

/*
 * Use your own validation token. Check that the token used in the Webhook 
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === VALIDATION_TOKEN) {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
});

/*
 * Listen for POST calls at the webhook. All callbacks will be made to this 
 * webhook.
 */
app.post('/webhook', function(req, res) {
    var data = req.body;
    // Make sure this is a page subscription
    if (data.object === 'page') {

        // Iterate over each entry, there might be multiple if batched
        data.entry.forEach(function(entry) {
            var pageID = entry.id;
            var timeOfEvent = entry.time;

            // Iterate over each messaging event
            entry.messaging.forEach(function(event) {
                if (event.message) {
                    receivedMessage(event);
                } else {
                    console.log("Webhook received unknown event: ", event);
                }
            });
        });

        // Assume all went well
        //
        // A 200 response code must be sent back within 20 seconds to let
        // facebook know that the callback is successfully received. otherwise
        // the requst will timeout and facebook will keep trying to resend
        res.sendStatus(200);
    }
});

/*
 * Handle received message
 */
function receivedMessage(event) {
    console.log("This is event object: ", event);
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timeStamp;
    var message = event.message;

    console.log("Recieved message for user %d and page %d at %d with message: ",
        senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));

    var messageID = message.mid;

    var messageText = message.text;
    var messageAttachments = message.attachments;

    if (messageText) {

        // If we receive a text message, check to see if it matches a keyword
        // and send back the example. Otherwise, just echo the text we received
        switch (messageText) {
            case 'generic':
                sendGenericMessage(senderID);
                break;

            default:
                sendTextMessage(senderID, messageText);
        }
    } else if (messageAttachments) {
        sendTextMessage(senderID, "Message with attachments received");
    }
}

function sendGenericMessage(recipientId, messageText) {
    // To be expanded in later sections
}

/**
 * Format the message data in appropiate format and call the Send API to 
 * send the message
 */
function sendTextMessage(recipientID, messageID) {
    var messageData = {
        recipient: {
            id: recipientID
        },
        message: {
            text: messageText
        }
    };

    callSendAPI(messageData);
}

/**
 * Call the send api to send the message back
 */
function callSendAPI(messageData) {
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: PAGE_ACCESS_TOKEN },
        method: 'POST',
        json: messageData
    }, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientID = body.recipient_id;
            var messageId = body.message_id;

            console.log('Successfully sent generic message');
        } else {
            console.error("Unable to send message.");
            console.error(response);
            console.error(error);
        }

    });
}

app.set('port', process.env.PORT || 3000);

http.listen(app.get('port'), function() {
    console.log('Listening on port 3000...');
})