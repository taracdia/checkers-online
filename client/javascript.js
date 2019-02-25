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
      //The boolean isDoubleJumping is true when they have just finished jumping a token AND they are capable of jumping another
      if (isDoubleJumping && !($(this).hasClass("possibleJump"))) {
        //If they are capable of continuing a double jump, they must
        $("#statusMessage").text("You must jump again!");
      } else {
        //If there is already a selected square, the token on the selected square will attempt to move to the clicked square
        var newPossibleJumps = move($(this), $("#selected"));
        //If this move begins or continues a double jump, the "move" function will return an array of possibilities for the next jumps
        //Then if there are any possibilities, they get the class "possibleJump" added so that they can be tested in the previous if statement when they move again
        for (let square of newPossibleJumps) {
          square.addClass("possibleJump");
        }
      }
    }
  });
}

//This function handles a walk (moving one square over, diagonally) if possible, a jump (capturing one of the enemy's tokens) if possible, or if neither is possible, it removes the "selected" ID and the classes of possible moves. This allows the player to select a different token to move
function move(clickedSquare, selectedSquare) {
  //This array  will be empty unless the player jumps and has the possibility to jump again
  var newJumpPossibilities = [];
  if (clickedSquare.hasClass("possibleWalk")) {
    //If the player clicks on a square that their token can "walk" to, that square is updated to contain the token and the previous square is updated to not have the square
    updateClassesAfterMove(clickedSquare, selectedSquare);
    //Then the turn is over
    finishTurn();
  } else if (clickedSquare.hasClass("possibleJump")) {
    //If the player clicks on a square that their token can "jump" to, the token jumps there, captures the opponenent's token, and the new square is assessed to see if the token can jump again from there. Any new spots to jump to are saved in newJumpPossibilities
    newJumpPossibilities = jump(clickedSquare, selectedSquare);
    if (newJumpPossibilities.length === 0) {
      //If there are no new jump possibilities, the turn ends because the player cannot continue to jump
      finishTurn();
    } else {
      //If they are able to jump again, the square that they jumped to becomes the new selected square so that they can jump from it
      clickedSquare.attr("id", "selected");
      $("#statusMessage").text("You get to jump again!");
      isDoubleJumping = true;
    }
  }

  //Regardless of what happens with moving or not moving, the square that had been selected is no longer selected and the squares that were marked as possible moves are unmarked by removing their classes
  selectedSquare.removeAttr("id");
  $(".possibleJump").removeClass("possibleJump");
  $(".possibleWalk").removeClass("possibleWalk");

  return newJumpPossibilities;
}

//This function returns the possible moves that a token can make from its square. The possible jumps and possible walks are separated by type so that the possible walks can be excluded when considering double jumps
function getPossibleMoves(inputSquare) {
  //Create empty arrays
  var possibleWalks = [];
  var possibleJumps = [];

  //Get the square's coordinates and whether the token is a king
  var location = getLocation(inputSquare);
  var col = location.col;
  var row = location.row;
  var isKing = inputSquare.hasClass(myColor + "King");

  //This small array allows the program to iterate over (col+1, row+1), (col-1, row+1), (col+1, row-1), (col-1, row-1) without code duplication. Each coordinate refers to a square that is diagonally adjacent to the inputSquare
  var offsetArray = [-1, 1];
  var square;
  var contents;

  //Iterating over the offsetArray twice to get every diagonal neighbor and test each
  for (let i = 0; i < offsetArray.length; i++) {
    for (let j = 0; j < offsetArray.length; j++) {
      //This ensures that moves where the token moves backwards are not valid unless the token is a king. When i is 0, the row offset is -1. That means that the token would be moving towards the top of the board, (because each row is numbered from top to bottom) which is valid. So if i is 1, the token is trying to move towards the bottom of the board, which it can't do unless it's a king. So the function immediately excludes invalid moves from being considered possible moves
      if (i === 0 || (i === 1 && isKing)) {
        //This gets the neighbor square that is being considered as a possible move site
        square = getSquareByLocation(col + offsetArray[j], row + offsetArray[i]);

        //getSquareContents() only returns a string with information in it if the square it is given exists. So there is no worry that trying to handle an undefined object would crash the program because the square is only handled if its contents are "empty" or "oppColor". Both mean that the square exists
        contents = getSquareContents(square);
        //If the square is empty, the token could walk there, so the square is added to possibleWalks
        if (contents === "empty") {
          possibleWalks.push(square);
          //If the square has one of the opponent's tokens on it, it needs to be tested for jumping over possibilities
        } else if (contents === "oppColor") {
          //This redefines "square" as the square that is on the other side of the neighbor square, in a straight line from the input square
          square = getSquareByLocation(col + 2 * offsetArray[j], row + 2 * offsetArray[i]);
          contents = getSquareContents(square);
          //This checks that "square" is a square that exists and is empty (so that the token on inputSquare can jump to it, over the opponent's token that is between inputSquare and "square")
          if (contents === "empty") {
            possibleJumps.push(square);
          }
        }
      }
    }
  }
  //Return each array separately
  return {
    walks: possibleWalks,
    jumps: possibleJumps,
  }
}
//This function returns a single square that is located at the coordinates provided by taking advantage of the fact that there is only one square that has both location classes
function getSquareByLocation(colNum, rowNum) {
  return $(".col" + colNum + ".row" + rowNum);
}

//This function determines whether the inputted square exists, and if so, its occupation status
function getSquareContents(inputSquare) {
  //This checks if the square exists
  if (inputSquare.length != 0) {
    //If the square has an opponent's token on it, return "oppColor"
    if (inputSquare.hasClass(oppColor)) {
      return "oppColor";
    } else {
      //If the square doesn't have an opponent's token or one of the player's tokens, it must be empty, so return "empty"
      if (!inputSquare.hasClass(myColor)) {
        return "empty";
      }
    }
  }
  //Those are the only two states that are important, so if the square's state does not match either of those two states, just return an empty string
  return "";
}

//This function handles one of the player's tokens capturing an opponent's token by jumping over it
//It does not handle checking if the jump is possible. That is checked before this function is called
function jump(clickedSquare, selectedSquare) {
  var selectedLocation = getLocation(selectedSquare);
  var clickedLocation = getLocation(clickedSquare);
  //The square between where the player's token jumps from and jumps to, is selected
  var middleSquare = getSquareByLocation((clickedLocation.col + selectedLocation.col) / 2, (clickedLocation.row + selectedLocation.row) / 2);
  //The middle square is emptied because its token has been captured
  middleSquare.removeClass(oppColor);
  middleSquare.removeClass(oppColor + "King");

  //This handles the actual move of the token from selectedSquare to clickedSquare
  updateClassesAfterMove(clickedSquare, selectedSquare);

  //This finds and returns any possible jumps that the token can do from its new square
  //It's important to note that only the jumps matter because a token can only jump after a jump, not walk
  //This is also only checked for after the token has already completed a successful jump. Tokens cannot double jump after a walk
  return getPossibleMoves(clickedSquare).jumps;
}

//This function handles the states of the 2 squares where a token is moved from selectedSquare to clickedSquare
//It does NOT handle any consequences of jumping
function updateClassesAfterMove(clickedSquare, selectedSquare) {
  //If the token was a king when it started jumping, it should be a king when it finishes jumping, but the square it jumped from shouldn't have the king class anymore
  if (selectedSquare.hasClass(myColor + "King")) {
    selectedSquare.removeClass(myColor + "King");
    clickedSquare.addClass(myColor + "King");
  }

  //The new square has the token's class and the old square loses it
  clickedSquare.addClass(myColor);
  selectedSquare.removeClass(myColor);

  //If any of the player's tokens are at the top row, they become a King
  //This check is done here so that the player can jump to the last row, then double jump away from it
  $("." + myColor + ".row0").addClass(myColor + "King");
}

//This takes the board array that was created by their opponent's formatBoardArray() and sent to them and interprets it into the board to show
function updateBoard(boardArray) {

  var square;
  var absPos;
  var col;
  var row;
  for (var i = 0; i < boardArray.length; i++) {
    //This flips the board so that each player will ALWAYS see their color at the bottom of the screen (As if the two players are sitting down at a physical board to play)
    //This is necessary because this function is only ever used to interpret data coming from their opponent, who sees the board as having THEIR color at the bottom
    //If the board wasn't going to be flipped, absPos would just equal i
    absPos = 63 - i;

    col = absPos % 8;
    row = Math.floor(absPos / 8);
    square = getSquareByLocation(col, row);
    //The square has any original occupants removed so that it can be updated
    square.removeClass("black red redKing blackKing");
    //This reverses the translation in formatBoardArray()
    switch (boardArray[i]) {
      case "B":
        square.addClass("black");
        break;
      case "R":
        square.addClass("red");
        break;
      case "BK":
        //Kings always still have the class of their color. This is so that they will still behave like tokens of that color
        square.addClass("black");
        square.addClass("blackKing");
        break;
      case "RK":
        square.addClass("red");
        square.addClass("redKing");
        break;
      case "0":
        //In this case, the square is meant to be empty and so it doesn't have any classes added
        break;
    }
  }
}

//This creates an array of the occupation state of each square on the board. This will then be sent to the server who sends it to the opponent, who interprets it to show this player's board state on the opponent's screen
function formatBoardArray() {
  var boardArray = [];
  var square;
  for (var i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      //This gets every square, one by one
      square = getSquareByLocation(j, i);
      //Then each square's status is recorded, in order, in the array
      //Kings are checked first because a redKing will have the class red as well and we don't want the if statement to skip over checking for the redKing class
      if (square.hasClass("redKing")) {
        boardArray.push("RK");
      } else if (square.hasClass("blackKing")) {
        boardArray.push("BK");
      } else if (square.hasClass("red")) {
        boardArray.push("R");
      } else if (square.hasClass("black")) {
        boardArray.push("B");
      } else {
        //If the square doesn't have any of these classes, it must be empty. This is represented by "0"
        boardArray.push("0");
      }
    }
  }
  return boardArray;
}

//This function handles the player finishing their turn, telling the other player what they changed, and waiting for the other player to move. It also handles when the player has won
function finishTurn() {
  //isMyTurn becomes false so that they cannot move while it is not their turn
  isMyTurn = false;
  //If they have just finished their turn, they can't be double jumping anymore
  isDoubleJumping = false;
  //This player has won the game if there are no tokens left in their opponent's color
  //There is no need to check if this player has just lost the game because they cannot lose the game on their turn
  var gameWon = $("." + oppColor).length === 0;
  socket.emit("finishedTurn", {
    //This client tells the server, which tells their opponent whether they have won the game and what the updated board looks like now
    boardArray: formatBoardArray(),
    gameOver: gameWon,
  });
  if (gameWon) {
    //If they have just won, congratulate them and prevent them from moving by updating the boolean gameIsOver
    gameIsOver = true;
    alert("Congratulations, you won! Refresh the page to play again!");
    $("#statusMessage").text("You won!");
  } else {
    $("#statusMessage").text("Wait for your opponent to move.");
  }
}

//This gets the row and column of the input square by taking advantage of their classes which recorded their row and column numbers
function getLocation(square) {
  var classes = square.attr("class");

  return {
    //This function finds the digit that is right next to either col/row and returns it in the form of an integer
    col: parseInt(classes.match(/col(\d)/)[1]),
    row: parseInt(classes.match(/row(\d)/)[1])
  };
}
