var app = require('express')();
var http = require('http').Server(app);

/**
 * setup the app and listen to a port for serving
 */
app.set('port', process.env.PORT || 3000);

http.listen(app.get('port'), function() {
    console.log('Listening on port 3000...');
})

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////

const bodyParser = require('body-parser');
const request = require('request');
const Wit = require('node-wit').Wit;
const log = require('node-wit').log;


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
const MY_ID = 1214205752005500;
const WIT_TOKEN = 'EYISYVULA6ZXTSC2VJ3IMBBQOENGE6JD';
const WEATHER_TOKEN = '34caf28dbfade76665681a696481d210';

//----------------------------------------------------
// Wit.ai specific code
// Each session has an entry:
// SessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
    let sessionId;
    // check if we already have a session for the user fbid
    Object.keys(sessions).forEach(k => {
        if (sessions[k].fbid === fbid) {
            // got it
            sessionId = k;
        }
    });
    if (!sessionId) {
        // No session found for user fbid, create a new one
        sessionId = new Date().toISOString();
        sessions[sessionId] = { fbid: fbid, context: {} };
    }
    return sessionId;
}

// I dont know what this is for, but its required ;)
const firstEntityValue = (entities, entity) => {
    const val = entities && entities[entity] &&
        Array.isArray(entities[entity]) &&
        entities[entity].length > 0 &&
        entities[entity][0].value;
    if (!val) {
        return null;
    }
    return typeof val === 'object' ? val.value : val;
};


// bot actions
const actions = {
    send({ sessionId }, { text }) {
        // bot has something to say
        // lets retrieve the facebook user who the session belongs to
        const recipientId = sessions[sessionId].fbid;
        sendTextMessage(recipientId, text);
    },
    getForecast({ context, entities }) {
        var location = firstEntityValue(entities, 'location');
        if (location) {
            context.forecast = 'sunny in ' + location; // we should call a weather API here
            delete context.missingLocation;
        } else {
            context.missingLocation = true;
            delete context.forecast;
        }
        return context;
    },
    greetUser({ context, entities }) {
        context.greet = "Hello there. How are you?";
        return context;
    }
};

// Setting up the bot
const wit = new Wit({
    accessToken: WIT_TOKEN,
    actions,
    logger: new log.Logger(log.INFO)
});


//------------------------------------------------------

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
                } else if (event.postback) {
                    receivedPostback(event);
                } else {
                    // console.log("Webhook received unknown event: ", event);
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
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;

    // We retrieve the user's current session, or create one if it doesn't exist
    // This is needed for our bot to figure out the conversation history
    const sessionId = findOrCreateSession(senderID);

    //console.log(JSON.stringify(message));

    var messageID = message.mid;

    var messageText = message.text;
    var messageAttachments = message.attachments;

    if (messageText) {

        // Let's forward the message to the Wit.ai Bot Engine
        // This will run all actions until our bot has nothing left to do
        wit.runActions(
                sessionId, // the user's current session
                messageText, // the user's message
                sessions[sessionId].context // the user's current session state
            ).then((context) => {
                // Our bot did everything it has to do.
                // Now it's waiting for further messages to proceed.
                console.log('Waiting for next user messages');

                // Based on the session state, you might want to reset the session.
                // This depends heavily on the business logic of your bot.
                // Example:
                // if (context['done']) {
                //   delete sessions[sessionId];
                // }

                // Updating the user's current session state
                sessions[sessionId].context = context;
            })
            .catch((err) => {
                console.error('Oops! Got an error from Wit: ', err.stack || err);
            });

        // If we receive a text message, check to see if it matches a keyword
        // and send back the example. Otherwise, just echo the text we received
        switch (messageText) {
            case 'info':
                getMyInfo(senderID);
                sendMyInfo(senderID);
                break;

                // default:
                //     sendTextMessage(senderID, messageText);
        }
    } else if (messageAttachments) {
        sendTextMessage(senderID, "Message with attachments received");
    }
}

function sendMyInfo(recipientId) {

    // request for user data and use the data
    getUserDetails(MY_ID, function(data) {
        data = JSON.parse(data);
        var firstName = data.first_name;
        var lastName = data.last_name;
        var profilePicture = data.profile_pic;

        var messageData = {
            recipient: {
                id: recipientId
            },
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "generic",
                        elements: [{
                            title: firstName + ' ' + lastName,
                            subtitle: "Web Devoloper at Codelogicx",
                            image_url: profilePicture,
                            buttons: [{
                                type: "web_url",
                                url: "https://iamsayantan.github.io",
                                title: "View my website"
                            }, {
                                type: "postback",
                                title: "Hello!!",
                                payload: "Payload for first bubble",
                            }],
                        }, ]
                    }
                }
            }
        };

        callSendAPI(messageData);
    });

}

/**
 * Handle postback calls
 */
function receivedPostback(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var payload = event.postback.payload;

    // request for user data and use the data
    getUserDetails(senderID, function(data) {
        data = JSON.parse(data);
        var firstName = data.first_name;
        var returnMessage = "Hello " + data.first_name + ", it's nice to meet you!";
        sendTextMessage(senderID, returnMessage);
    });

}


/**
 * Query the graph api to get details of the user so that I can personalize the message
 */
function getUserDetails(userID, callback) {
    request({
        uri: 'https://graph.facebook.com/v2.6/' + userID,
        qs: {
            fields: 'first_name, last_name, gender, profile_pic',
            access_token: PAGE_ACCESS_TOKEN
        },
        method: 'GET'
    }, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log("Successfully fetched user data");
            callback(body);
        } else {
            console.error("Unable to fetch user data.");
            // console.error(response);
            // console.error(error);
        }

    });
}

/**
 * get all my info and make cards with them
 */
function getMyInfo(recipientID) {
    const github_url = 'https://api.github.com/users/iamsayantan/repos';
    var repoData = [];
    request({
        uri: github_url,
        method: 'GET',
        headers: { 'user-agent': 'node.js' }
    }, function(error, response, body) {
        body = JSON.parse(body);
        for (repo in body) {
            // console.log(body[repo]);
            var temp = {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: [{
                        title: body[repo].full_name,
                        subtitle: body[repo].description,
                        image_url: 'https://scontent.fdel1-2.fna.fbcdn.net/v/t1.0-9/15085548_1229299697132024_2694627972761628614_n.jpg?oh=7c13b94ebc363076aab5a30eefd13206&oe=5918EB2C',
                        buttons: [{
                            type: "web_url",
                            url: body[repo].html_url,
                            title: "Visit the repo"
                        }, {
                            type: "postback",
                            title: "Hello!!",
                            payload: "Payload for first bubble",
                        }],
                    }, ]
                }
            }
            repoData.push(temp);
        }
        var messageData = {
            recipient: {
                id: recipientID
            },
            message: {
                attachment: repoData
            }
        };
        callSendAPI(messageData);
    });
}

/**
 * Format the message data in appropiate format and call the Send API to 
 * send the message
 */
function sendTextMessage(recipientID, messageText) {
    var quickReplies = [{
            "content_type": "text",
            "title": "Red",
            "payload": "DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_RED",
            "image_url": "http://www.goodmanrealtor.com/shared/search/version-10/images/measle_red-lrg-1-1.png"
        },
        {
            "content_type": "text",
            "title": "Green",
            "payload": "DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_GREEN",
            "image_url": "http://www.hulabanban.com/Content/images/lnz-dian.png"
        }
    ];
    var messageData = {
        recipient: {
            id: recipientID
        },
        message: {
            text: messageText,
            // quick_replies: quickReplies
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
            console.log("Successfully sent message");
            console.log(body);
        } else {
            console.error("Unable to send message.");
            // console.error(response);
            console.error(error);
        }

    });
}