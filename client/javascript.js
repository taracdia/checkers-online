var socket = io();

//Global variables that need to be accessible outside of any function
//This variable changes frequently and needs to be accessed and changed by many functions
let isMyTurn;
let isDoubleJumping = false;
let gameIsOver = false;

//These variables are only assigned values once but they need to keep that value for as long as the client is connected
let oppColor;
let myColor;

//This connects to the button's onclick method and gets the name of the room that the client wants to join and sends it to the server for processing
var getRoom = function(event) {
  //This prevents the button from submitting a get request, which would make the client disconnect and reconnect
  event.preventDefault();

  //Get the value from the text input box
  var possRoomName = document.getElementById("roomName").value;
  //Data validation
  if (possRoomName != "") {
    socket.emit("joinRoom", {
      roomName: possRoomName,
    });
  }
}

//If this is sent back, it means that there were already 2 clients in the requested room
socket.on("tooMany", function() {
  $("#statusMessage").text("Sorry, that game is full! Try another.");
});

//This will only be seen by player 1 (black) since player 2 will never have to wait for their opponent to join
socket.on("opponentJoined", function() {
  $("#statusMessage").text("A challenger appears! Begin!");
  //This lets the player make moves
  isMyTurn = true;
});

//This is what is returned if the client succcessfully joins the room they requested
socket.on("roomJoinSuccessful", function(data) {
  //Hide the form where they joined the room since they can only be in one room (one game) at a time
  $("form").hide();
  $("#gameName").text("Game room: " + data.roomName);


  //At the beginning, neither player can move. Black has to wait for Red to connect and Red has to wait for Black to move
  isMyTurn = false;

  //This variable is determined by room joining order
  if (data.playsBlack) {
    $("#statusMessage").text("You play black. Wait for your opponent to connect, then you'll play first.");
    myColor = "black";
    oppColor = "red";
  } else {
    $("#statusMessage").text("You play red. Wait for your opponent to move.");
    myColor = "red";
    oppColor = "black";
  }

  setUpBoard();
});

//When client receives message that other player finished their turn
socket.on("opponentFinishedTurn", function(data) {
  //Update the board regardless of whether or not the player lost so that they can see how they lost
  //Updates the board based on how the opponent just changed it
  updateBoard(data.boardArray);
  //If the opponent tells the client that the game is over, it must be because the opponent won
  if (data.gameOver) {
    gameIsOver = true;
    alert("That's game over! Sorry but you lost this one! Refresh to play again!");
    $("#statusMessage").text("You lost!");
  } else {
    //Update the variable so that the client can make their move
    isMyTurn = true;
    $("#statusMessage").text("Your turn!");
  }
});

//If their opponent disconnected, tell them and make it so they can't make any further moves
socket.on("partnerDisconnected", function() {
  isMyTurn = false;
  gameIsOver = true;
  $("#statusMessage").text("Opponent resigned!");
  alert("Sorry, your partner disconnected. But that means you won! Congratulations! Refresh the page to play again!")
});

//Sets the boards original configuration and creates the onclick method that controls all of the gameplay
function setUpBoard() {
  //Creates an 8x8 board (as a table) with alternating light and dark squares
  var row;
  var square;
  for (var i = 0; i < 8; i++) {
    row = $(document.createElement("TR"));
    $("#board").append(row);

    for (var j = 0; j < 8; j++) {
      square = $(document.createElement("TD")).addClass("square");
      if ((j % 2 == 0 && i % 2 == 0) || (j % 2 != 0 && i % 2 != 0)) {
        square.addClass("light");
      } else {
        square.addClass("dark");
      }
      //Each column and each row have their own class so they can be selected as a group
      square.addClass("col" + j);
      square.addClass("row" + i);
      row.append(square);
    }
  }

  //Sets it so that each player sees their color tokens at the bottom of the board and sees their opponent's at the top
  //Adding the class "black" or "red" to a square is how the board shows that the square is occupied by a token of that color. The CSS for the class adds a background image of a token of that color
  $(".dark.row0").addClass(oppColor);
  $(".dark.row1").addClass(oppColor);
  $(".dark.row2").addClass(oppColor);

  $(".dark.row5").addClass(myColor);
  $(".dark.row6").addClass(myColor);
  $(".dark.row7").addClass(myColor);

  //All gameplay is controlled by this function because all gameplay happens on the dark squares
  $(".dark").click(function() {
    //If the game is over, don't respond to clicks
    if(gameIsOver){
      return;
    }
    //If it's not their turn to move, tell the user so they don't think it's broken, but don't let them change anything
    if (!isMyTurn) {
      $("#statusMessage").text("Not your turn yet!");
      return;
    }

    //If there is not already a selected square
    if ($("#selected").length === 0) {
      //They can only select their own tokens to move
      if ($(this).hasClass(myColor)) {
        //This marks every possible move of the clicked token
        //Marking all of the possible moves with classes means that their values can be easily accessed from multiple functions
        var possibleMoves = getPossibleMoves($(this));
        if (possibleMoves.walks.length > 0 || possibleMoves.jumps.length > 0) {
          for (let square of possibleMoves.walks) {
            square.addClass("possibleWalk");
          }
          for (let square of possibleMoves.jumps) {
            square.addClass("possibleJump");
          }
          //The square gets the ID "selected" only if it has possible moves to make
          $(this).attr("id", "selected");
        }
      }
      //If there is already a selected square
    } else {
      if (isDoubleJumping && !($(this).hasClass("possibleJump"))) {
        $("#statusMessage").text("You must jump again!");
      } else {
        var newPossibleJumps = move($(this), $("#selected"));
        for (let square of newPossibleJumps) {
          square.addClass("possibleJump");
        }
      }
    }
  });
}

function move(clickedSquare, selectedSquare) {
  var newJumpPossibilities = [];
  if (clickedSquare.hasClass("possibleWalk")) {
    updateClassesAfterMove(clickedSquare, selectedSquare);
    finishTurn();
  } else if (clickedSquare.hasClass("possibleJump")) {
    newJumpPossibilities = jump(clickedSquare, selectedSquare);
    if (newJumpPossibilities.length === 0) {
      finishTurn();
    } else {
      clickedSquare.attr("id", "selected");
      $("#statusMessage").text("You get to jump again!");
      isDoubleJumping = true;
    }
  }
  selectedSquare.removeAttr("id");
  $(".possibleJump").removeClass("possibleJump");
  $(".possibleWalk").removeClass("possibleWalk");

  return newJumpPossibilities;
}

function getPossibleMoves(inputSquare) {
  var possibleWalks = [];
  var possibleJumps = [];

  var location = getLocation(inputSquare);
  var col = location.col;
  var row = location.row;
  var isKing = inputSquare.hasClass(myColor + "King");

  var offsetArray = [-1, 1];
  var square;
  var contents;

  for (let i = 0; i < offsetArray.length; i++) {
    for (let j = 0; j < offsetArray.length; j++) {
      if (i === 0 || (i === 1 && isKing)) {
        square = getSquareByLocation(col + offsetArray[j], row + offsetArray[i]);
        contents = getSquareContents(square);
        if (contents === "empty") {
          possibleWalks.push(square);
        } else if (contents === "oppColor") {
          square = getSquareByLocation(col + 2 * offsetArray[j], row + 2 * offsetArray[i]);
          contents = getSquareContents(square);
          if (contents === "empty") {
            possibleJumps.push(square);
          }
        }
      }
    }
  }
  return {
    walks: possibleWalks,
    jumps: possibleJumps,
  }
}

function getSquareByLocation(colNum, rowNum) {
  return $(".col" + colNum + ".row" + rowNum);
}

function getSquareContents(inputSquare) {
  if (inputSquare.length != 0) {
    if (inputSquare.hasClass(oppColor)) {
      return "oppColor";
    } else {
      if (!inputSquare.hasClass(myColor)) {
        return "empty";
      }
    }
  }
  return "";
}

function jump(clickedSquare, selectedSquare) {
  var selectedLocation = getLocation(selectedSquare);
  var clickedLocation = getLocation(clickedSquare);
  var middleSquare = getSquareByLocation((clickedLocation.col + selectedLocation.col) / 2, (clickedLocation.row + selectedLocation.row) / 2);
  middleSquare.removeClass(oppColor);
  middleSquare.removeClass(oppColor + "King");
  updateClassesAfterMove(clickedSquare, selectedSquare);
  return getPossibleMoves(clickedSquare).jumps;
}

function updateClassesAfterMove(clickedSquare, selectedSquare) {
  if (selectedSquare.hasClass(myColor + "King")) {
    selectedSquare.removeClass(myColor + "King");
    clickedSquare.addClass(myColor + "King");
  }
  clickedSquare.addClass(myColor);
  selectedSquare.removeClass(myColor);

  $("." + myColor + ".row0").addClass(myColor + "King");
}

function updateBoard(boardArray) {
  var square;
  var absPos;
  var col;
  var row;
  for (var i = 0; i < boardArray.length; i++) {
    absPos = 63 - i;
    col = absPos % 8;
    row = Math.floor(absPos / 8);
    square = getSquareByLocation(col, row);
    square.removeClass("black red redKing blackKing");
    switch (boardArray[i]) {
      case "B":
        square.addClass("black");
        break;
      case "R":
        square.addClass("red");
        break;
      case "BK":
        square.addClass("black");
        square.addClass("blackKing");
        break;
      case "RK":
        square.addClass("red");
        square.addClass("redKing");
        break;
      case "0":
        break;
    }
  }
}

function formatBoardArray() {
  var boardArray = [];
  var square;
  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      square = getSquareByLocation(j, i);
      if (square.hasClass("redKing")) {
        boardArray.push("RK");
      } else if (square.hasClass("blackKing")) {
        boardArray.push("BK");
      } else if (square.hasClass("red")) {
        boardArray.push("R");
      } else if (square.hasClass("black")) {
        boardArray.push("B");
      } else {
        boardArray.push("0");
      }
    }
  }
  return boardArray;
}

function finishTurn() {
  isMyTurn = false;
  isDoubleJumping = false;
  var gameWon = $("." + oppColor).length === 0;
  socket.emit("finishedTurn", {
    boardArray: formatBoardArray(),
    gameOver: gameWon,
  });
  if (gameWon) {
    gameIsOver = true;
    alert("Congratulations, you won! Refresh the page to play again!");
    $("#statusMessage").text("You won!");
  } else {
    $("#statusMessage").text("Wait for your opponent to move.");
  }
}

function getLocation(square) {
  var classes = square.attr("class");

  return {
    col: parseInt(classes.match(/col(\d)/)[1]),
    row: parseInt(classes.match(/row(\d)/)[1])
  };
}
