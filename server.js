const express = require("express");
const SocketServer = require("ws").Server;
const redis = require("redis");
var cors = require("cors");
const PORT = process.env.PORT|| 3000;

// Create the Express object
var app = express();

app.use(cors());

// app.get("/events", (req, res) => {
//   console.log('get events');
//   // placeholder for GQL universe events ?
//   const events = [{
//     id: 'testtest2',
//     name: 'name',
//     description: 'description',
//     startTime: 'right now',
//     coverPicture: 'www.google.com'
//   }, {
//     id: 'testtest3',
//     name: 'name 2',
//     description: 'description 2',
//     startTime: 'right now',
//     coverPicture: 'www.google.com'
//   }];
//   res.json(events);
// })

const server = app.listen(PORT, () => {
  console.log("Listening on port " + PORT);
});

const wss = new SocketServer({ server });

const redisClient = redis.createClient();


const userClientMap = {};
const clientUserMap = {};
        // // // only set fields if doesn't exist
        // redisClient.hmset("user:${viewerId}", [
        //     "name": name,
        //     "swiperNode:${friendId}": "viewerFriendLiked:${viewerId}${friendID}"
        //     ], 'NX')

// lol this is confusing delete all later

wss.on("connection", (client, req) => {
  console.log("client connected")

  client.on("message", (msg) => {
    const message = JSON.parse(msg);
    switch(message.type) {
      case "connectViewer":
        // nx only set the key if it doenst exist
        // generates a uuid upon ws connection
        userClientMap[message.payload.viewerId] = client;
        clientUserMap[client] = message.payload.viewerId;
        break;
      case "eventLike":
        // first check liked event against redis node if friend already liked
        const eventId = message.payload.eventId;
        const friendId = message.payload.friendId;
        const friendName = message.payload.friendName;
        const viewerName = message.payload.viewerName;
        const viewerId = message.payload.viewerId;
        const friendClient = userClientMap[friendId];
        console.log('viewerfriend ids', viewerId, friendId);
        console.log(message.payload);
        // check friends liked events if this swipe is a mutual like O(1) time
        redisClient.sismember(`viewerFriendLiked:${friendId}${viewerId}`, eventId, (err, res) => {
          // mutual like
          if (res) {
            console.log('this is an event like and also a match')
            const matchEventViewer = {
              type: "matchEvent",
              payload: {
                friendName,
                eventId,
              }
            };


            client.send(JSON.stringify(matchEventViewer));

            // if friend socket connected
            if (friendClient) {
              console.log('this is an event like and also a match and also friend is connected')
              const matchEventFriend = {
                type: "matchEvent",
                payload: {
                  friendName: viewerName,
                  eventId
                }
              }

              friendClient.send(JSON.stringify(matchEventFriend))
            }
            // otherwise push notification
            else {
              console.log('this is an event like and also a match and also friend is not connected')
              console.log('push notification')
            }
          }
          // if not mutual event store like
          else {
            // deal with solving expiring events later on ?
            console.log('this is an event like and also not a match')
            console.log(`viewerFriendLiked:${viewerId}${friendId}`)
            redisClient.sadd(`viewerFriendLiked:${viewerId}${friendId}`, eventId);
          }
        })
      break;
    }
  })

  client.on("close", () => {
    delete userClientMap[clientUserMap[client]];
  })
})


