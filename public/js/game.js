/* global Phaser RemotePlayer io */

var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update, render: render })


var SorryAlex = 0
function preload() {
  this.load.image('earth', 'assets/light_sand.png')
  this.load.image('dude', 'assets/car.png', 64, 64)
  this.load.image('enemy', 'assets/car2.png', 64, 64)
  this.load.tilemap('track1', 'assets/track1.json', null, Phaser.Tilemap.TILED_JSON);
  this.load.image('tileset', 'assets/tileset.png');
  this.load.image('finline', 'assets/finline.png');
  this.load.audio('racestart', 'assets/snd/racestart.wav');
  this.load.image('go', 'assets/img/go.png');
  this.load.image('tileset', 'assets/tileset.png');
}

var socket // Socket connection

var land

var player

var finline

var enemies

var currentSpeed = 0
var cursorsrs

var laps = 0;

function create() {
  socket = io.connect()

  // Resize our game world to be a 2000 x 2000 square
  this.game.world.setBounds(0, 0, 3200, 3200);

  // Our tiled scrolling background
  this.map = this.add.tilemap('track1');
  this.map.addTilesetImage('tileset', 'tileset');

  this.layer = this.map.createLayer('t1');
  this.layer.resizeWorld();
  this.layer.debug = false;

  this.map.setCollisionBetween(1 ,271 , 272);
  this.map.setCollisionBetween(359, 360);

  this.map.setTileIndexCallback(3073, () => {
    if (laps == 0) {
      laps = 1;
    }
    if (laps == 4) {
      laps = 5;
    }
    if (laps == 8) {
      laps = 9;
    }
  }, this)

  this.map.setTileIndexCallback(3074, () => {
    if (laps == 1) {
      laps = 2;
    }
    if (laps == 5) {
      laps = 6;
    }
    if (laps == 9) {
      laps = 10;
    }
  }, this)

  this.map.setTileIndexCallback(3075, () => {
    if (laps == 2) {
      laps = 3;
    }
    if (laps == 6) {
      laps = 7;
    }
    if (laps == 10) {
      laps = 11;
    }
  }, this)

  var style = { font: "17px Arial", fill: "#192AE3", align: "center" };
  var eStyle = { font: "17px Arial", fill: "#ED0505", align: "center" };
  this.text = this.add.text(0, 0, "You", style);
  this.text1 = this.add.text(0, 0, "Enemy", eStyle);
  // The base of our player
  var startX = game.rnd.integerInRange(320, 480);
  var startY = game.rnd.integerInRange(2976, 3072);

  finline = this.add.sprite(512, 2944, "finline");
  this.physics.arcade.enable(finline);

  finline.body.immovable = true;

  player = game.add.sprite(startX, startY, 'dude')
  player.anchor.setTo(0.5, 0.5)
  game.physics.enable(player, Phaser.Physics.ARCADE);
  player.body.maxVelocity.setTo(400, 400)
  player.body.collideWorldBounds = true

  this.racestarts = false;
  // This will force it to decelerate and limit its speed
  // player.body.drag.setTo(200, 200)

  this.time.events.add(Phaser.Timer.SECOND * 1, () => {
    this.racestart = this.add.audio('racestart');
    this.racestart.play();
    this.three = this.add.text(395, 250, "3");
    this.three.fill = "#ffffff";
    this.three.fixedToCamera = true;
  });

  this.time.events.add(Phaser.Timer.SECOND * 2, () => {
    this.three.alpha = 0;
    this.two = this.add.text(395, 250, "2");
    this.two.fill = "#ffffff";
    this.two.fixedToCamera = true;
    console.log(this.racestarts);

  });

  this.time.events.add(Phaser.Timer.SECOND * 3, () => {
    this.two.alpha = 0;
    this.one = this.add.text(395, 250, "1");
    this.one.fill = "#ffffff";
    this.one.fixedToCamera = true;
    console.log(this.racestarts);

  });

  this.time.events.add(Phaser.Timer.SECOND * 4, () => {
    this.one.alpha = 0;
    this.go = this.add.text(395, 250, "Go!");
    this.go.fill = "#ffffff";
    this.go.fixedToCamera = true;
    this.racestarts = true;
    console.log(this.racestarts);
  });

  this.time.events.add(Phaser.Timer.SECOND * 5, () => {
    this.go.alpha = 0;

  });

  // Create some baddies to waste :)
  enemies = []

  player.bringToTop()

  game.camera.follow(player)
  game.camera.deadzone = new Phaser.Rectangle(150, 150, 500, 300)
  game.camera.focusOnXY(0, 0)

  cursors = game.input.keyboard.createCursorKeys()

  // Start listening for events
  setEventHandlers()
}

var setEventHandlers = function () {
  // Socket connection successful
  socket.on('connect', onSocketConnected)

  // Socket disconnection
  socket.on('disconnect', onSocketDisconnect)

  // New player message received
  socket.on('new player', onNewPlayer)

  // Player move message received
  socket.on('move player', onMovePlayer)

  // Player removed message received
  socket.on('remove player', onRemovePlayer)
}

// Socket connected
function onSocketConnected() {
  console.log('Connected to socket server')

  // Reset enemies on reconnect
  enemies.forEach(function (enemy) {
    enemy.player.kill()
  })
  enemies = []

  // Send local player data to the game server
  socket.emit('new player', { x: player.x, y: player.y, angle: player.angle })
}

// Socket disconnected
function onSocketDisconnect() {
  console.log('Disconnected from socket server')
}

// New player
function onNewPlayer(data) {
  console.log('New player connected:', data.id)

  // Avoid possible duplicate players
  var duplicate = playerById(data.id)
  if (duplicate) {
    console.log('Duplicate player!')
    return
  }

  // Add new player to the remote players array
  enemies.push(new RemotePlayer(data.id, game, player, data.x, data.y, data.angle))
}

// Move player
function onMovePlayer(data) {
  var movePlayer = playerById(data.id)

  // Player not found
  if (!movePlayer) {
    console.log('Player not found: ', data.id)
    return
  }

  // Update player position
  movePlayer.player.x = data.x
  movePlayer.player.y = data.y
  movePlayer.player.angle = data.angle
}

// Remove player
function onRemovePlayer(data) {
  var removePlayer = playerById(data.id)

  // Player not found
  if (!removePlayer) {
    console.log('Player not found: ', data.id)
    return
  }

  removePlayer.player.kill()

  // Remove player from array
  enemies.splice(enemies.indexOf(removePlayer), 1)
}

function update() {
  console.log(laps);
  if (this.racestarts == true) {
    game.physics.arcade.collide(player, this.layer);

    this.text.x = player.x - 15
    this.text.y = player.y - 40

    if (SorryAlex = 5) {
      if (cursors.left.isDown) {
        player.angle -= 4
      } else if (cursors.right.isDown) {
        player.angle += 4
      }

      if (cursors.up.isDown) {
        // The speed we'll travel at
        currentSpeed = 300
      } else {
        if (currentSpeed > 0) {
          currentSpeed -= 4
        }
      }

      game.physics.arcade.velocityFromRotation(player.rotation, currentSpeed, player.body.velocity)

      if (game.input.activePointer.isDown) {
        if (game.physics.arcade.distanceToPointer(player) >= 10) {
          currentSpeed = 300

          player.rotation = game.physics.arcade.angleToPointer(player)
        }
      }

      socket.emit('move player', { x: player.x, y: player.y, angle: player.angle })
    }
  }

  if (laps => 3) {
      this.physics.arcade.collide(player, finline, lapCount, null, this);
    }

}


function ColsCheck() {
}

function render() {

}

// Find player by ID
function playerById(id) {
  for (var i = 0; i < enemies.length; i++) {
    if (enemies[i].player.name === id) {
      return enemies[i]
    }
  }

  return false
}

function lapCount() {
    player.x -= 75;
  if (laps == 3) {
    console.log("Lap 2");
    laps = 4;
  }
  if (laps == 7) {
    console.log("Lap 3");
    laps = 8;
  }
  if (laps == 11) {
    console.log("You win!");
  }
  }
