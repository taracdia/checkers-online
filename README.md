# checkers-online
This is a web app for playing checkers with friends remotely.
First, a server is set up with Express in Node.js. The server is set up to run on an arbitrary port and handles attempts to visit a certain website.
In this case, I've left the website as "localhost" on port 2000 to avoid needing to pay for an online server. If I was going to be able to actually use the program as it is intended,
I would need to host it online so that people can connect to friends from far away.
From the user's perspective, they go to the website and are greeted by an input box that asks them to create or join a game with a specific name.
Then they input the name that they had agreed upon with their friend. If they got there before their friend, they play black. Otherwise, they play red.
The board appears and they are able to play once both players have arrived. They are able to play a normal game of checkers until one side wins.
Then they are both informed of the win and invited to reload the page to begin the process over.
Behind the scenes, the server sends each client the file index.html via a get request when the user goes to the main page. At first, the page only has a form asking for the game name.
Once the user submits a game name in the form, it is sent to the server for processing. Socket.io has the client join (and possibly create) a room with that name, if there is room.
If there is no room with that name, one is created and the client joins it as the player playing black.
If there is already one client in the room, the client joins the room as the player playing red.
If there are already more than one client in the room, the client does not get to join the room and is told that the room is full.
Once the client joins a room and is assigned a token color, the form is hidden and the empty table with the id "board" is filled with alternating squares and the appropriate tokens.
The board is set up so that the player's tokens are at the bottom and their opponent's are at the top. On each turn, the player makes a move that changes the board.
Then, the board's new configuration is translated into an array of strings and sent to the server. The player is asked to wait and is prevented from making another move.
The server sends that array to every other client in the same room (this is only the opponent of the first player. This is why they both joined the same room).
When the opponent receives the array, they are informed that it is their turn and are allowed to move.
But first the array is flipped around (because each client sees the board with their tokens at the bottom) and translated back from strings to board configuration.
If all goes well, the two players will go back and forth until one wins. On that turn, the winner will be informed that they've won and will be invited to play again.
The loser will be told that they've lost by sending a true boolean (gameIsOver) along with the array. They will also be invited to play again.
