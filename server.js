const express = require('express');
const https   = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const sslOptions = {
  key: fs.readFileSync('./ssl/server.key'),
  cert: fs.readFileSync('./ssl/server.cert')
};

const server = https.createServer(sslOptions, app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store active rooms and user names
const rooms = new Map();
const userNames = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Set user name
  socket.on('setName', (name) => {
    userNames.set(socket.id, name);
  });

  // Create a new room
  socket.on('createRoom', (roomName) => {
    if (!rooms.has(roomName)) {
      rooms.set(roomName, new Set());
    }
    rooms.get(roomName).add(socket.id);
    socket.join(roomName);
    socket.emit('roomCreated', roomName);
    io.emit('roomList', Array.from(rooms.keys()));
  });

  // Join a room
  socket.on('joinRoom', (roomName) => {
    if (rooms.has(roomName)) {
      // Remove from any existing rooms first
      rooms.forEach((users, existingRoom) => {
        if (users.has(socket.id)) {
          users.delete(socket.id);
          socket.leave(existingRoom);
          if (users.size === 0) {
            rooms.delete(existingRoom);
          }
        }
      });

      // Join the new room
      rooms.get(roomName).add(socket.id);
      socket.join(roomName);
      socket.emit('roomJoined', roomName);

      // Get all users in the room
      const roomUsers = Array.from(rooms.get(roomName));
      
      // Send list of existing users to the new joiner
      socket.emit('roomUsers', roomUsers.map(userId => ({
        userId,
        userName: userNames.get(userId) || 'Anonymous'
      })));

      // Notify others in the room about the new user
      socket.to(roomName).emit('userJoined', {
        userId: socket.id,
        userName: userNames.get(socket.id) || 'Anonymous'
      });
    }
  });

  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', {
      sdp: data.sdp,
      target: socket.id,
      userName: userNames.get(socket.id) || 'Anonymous'
    });
  });

  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', {
      sdp: data.sdp,
      target: socket.id,
      userName: userNames.get(socket.id) || 'Anonymous'
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      target: socket.id
    });
  });

  // Leave room
  socket.on('leaveRoom', (roomName) => {
    if (rooms.has(roomName)) {
      rooms.get(roomName).delete(socket.id);
      if (rooms.get(roomName).size === 0) {
        rooms.delete(roomName);
      }
      socket.leave(roomName);
      socket.to(roomName).emit('userLeft', socket.id);
      io.emit('roomList', Array.from(rooms.keys()));
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    userNames.delete(socket.id);
    rooms.forEach((users, roomName) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        if (users.size === 0) {
          rooms.delete(roomName);
        }
        socket.to(roomName).emit('userLeft', socket.id);
      }
    });
    io.emit('roomList', Array.from(rooms.keys()));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 