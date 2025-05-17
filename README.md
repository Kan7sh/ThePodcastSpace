# Voice Chat Application

A real-time voice chat application that allows users to create and join voice channels for communication.

## Features

- Create voice chat rooms
- Join existing voice chat rooms
- Real-time voice communication using WebRTC
- Modern and responsive UI
- Room management (create, join, leave)

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- A modern web browser with WebRTC support

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd voice-chat-app
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

1. Start the server:
```bash
npm start
```

2. Open your web browser and navigate to:
```
http://localhost:3000
```

## Usage

1. Allow microphone access when prompted by your browser
2. Create a new room by entering a room name and clicking "Create"
3. Join an existing room by clicking the "Join" button next to the room name
4. Leave a room by clicking the "Leave Room" button

## Technical Details

- Backend: Node.js with Express and Socket.IO
- Frontend: HTML, CSS (Tailwind CSS), and JavaScript
- Real-time Communication: WebRTC for peer-to-peer voice communication
- Signaling: Socket.IO for WebRTC signaling

## Security Considerations

- The application uses STUN servers for NAT traversal
- All WebRTC connections are encrypted by default
- No voice data is stored on the server

## Browser Support

The application works best on modern browsers that support WebRTC:
- Chrome (recommended)
- Firefox
- Edge
- Safari

## License

MIT 