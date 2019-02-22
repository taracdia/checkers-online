//Setting up the server with Express
var express = require("express");
var app = express();
var serv = require("http").Server(app);

//When the user tries to go to the homepage/the opening page they send an empty get request. This sends back the file index.html to their browser
app.get("/", function(req, res) {
  res.sendFile(__dirname + "/client/index.html");
});

app.use(express.static("client"));

//Setting the port for the server
serv.listen(2000);
console.log("Server started")

var io = require("socket.io")(serv, {});

io.sockets.on("connection", function(socket) {
  console.log(socket.id + " socket connection");
  //Creating a variable outside of the other functions so that it's easy to set it and access it from within several functions
  var roomName;

  socket.on("joinRoom", function(data) {
    //This is the only time roomName will be updated because the form that emitted "joinRoom" is hidden after the client gets "roomJoinSuccessful"
    roomName = data.roomName;

    //These are the clients in the server that are in the room "roomName"
    var clients = io.sockets.adapter.rooms[roomName];

    //If "clients" is undefined, that means that there is currently no room called "roomName" and so there are no clients/players in that room yet
    if (typeof clients === "undefined") {
      //This creates the room "roomName" and adds the client to it
      socket.join(roomName);
      //If there were no clients in "roomName", that means that this client will be player 1 and so they will play as black.
      socket.emit("roomJoinSuccessful", {
        playsBlack: true,
        roomName: roomName,
      });
    } else {
      //This counts how many clients are already in "roomName"
      if (Object.keys(clients.sockets).length == 1) {
        socket.join(roomName);
        //If there is already exactly one client in "roomName", that means that this client will be player 2 and so they will not play black. They will play red.
        socket.emit("roomJoinSuccessful", {
          playsBlack: false,
          roomName: roomName,
        });
        //This will tell every other client in "roomName" (only one other client) that their opponent has joined, meaning that they can start the game
        socket.to(roomName).emit("opponentJoined");

        //The only other option is that there are already 2 players in "roomName". Only 2 players can play checkers so they are rejected and do not get to join the room.
      } else {
        //The variable roomName is set to an empty string so that it does not still contain the name of the room that the client was unable to join
        roomName = "";
        socket.emit("tooMany");
      }
    }
  });

  socket.on("finishedTurn", function(data) {
    //When one client has finished their turn, they tell the server and send it the updated board configuration as an array. Then this function passes the array to the other client in their room (their opponent). This function also tells the opponent whether the client has won the game
    //The variable roomName needed to be outside of the joinRoom function so that this function could emit "opponentFinishedTurn" ONLY to their opponent in their room and not every client connected to the server
    socket.to(roomName).emit("opponentFinishedTurn", {
      boardArray: data.boardArray,
      gameOver: data.gameOver,
    });
  });

  socket.on("disconnect", function() {
    //If the client disconnects, this function will immediately tell their opponent
    console.log(socket.id + " socket disconnected");
    socket.to(roomName).emit("partnerDisconnected");
  });

});
