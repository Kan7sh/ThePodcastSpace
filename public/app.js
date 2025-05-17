const socket = io();
let localStream;
let peerConnections = {};
let currentRoom = null;
let userName = '';
let audioContext;
let analysers = {};
let isMuted = false;

// DOM Elements
const userNameInput = document.getElementById('userName');
const setNameBtn = document.getElementById('setName');
const roomNameInput = document.getElementById('roomName');
const createRoomBtn = document.getElementById('createRoom');
const roomList = document.getElementById('roomList');
const activeRoom = document.getElementById('activeRoom');
const currentRoomName = document.getElementById('currentRoomName');
const participants = document.getElementById('participants');
const leaveRoomBtn = document.getElementById('leaveRoom');

// Set user name
setNameBtn.addEventListener('click', () => {
    const name = userNameInput.value.trim();
    if (name) {
        userName = name;
        userNameInput.disabled = true;
        setNameBtn.disabled = true;
        socket.emit('setName', name);
    }
});

// Initialize WebRTC
async function initializeMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Media initialized successfully');
        
        // Initialize audio context and analyzer
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(localStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 32; // Reduced for 5 bars
        source.connect(analyser);
        analysers[socket.id] = analyser;
        
        // Start audio wave visualization
        visualizeAudio(socket.id);
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Error accessing microphone. Please ensure you have granted microphone permissions.');
    }
}

// Create WebRTC peer connection
function createPeerConnection(userId) {
    const peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    });

    // Add local stream
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                target: userId,
                candidate: event.candidate
            });
        }
    };

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
        const audioElement = document.getElementById(`audio-${userId}`);
        if (audioElement) {
            audioElement.srcObject = event.streams[0];
            
            // Create analyzer for remote audio
            const source = audioContext.createMediaStreamSource(event.streams[0]);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 32; // Reduced for 5 bars
            source.connect(analyser);
            analysers[userId] = analyser;
            
            // Start audio wave visualization
            visualizeAudio(userId);
        }
    };

    return peerConnection;
}

// Audio wave visualization
function visualizeAudio(userId) {
    const canvas = document.getElementById(`wave-${userId}`);
    if (!canvas) return;

    const canvasCtx = canvas.getContext('2d');
    const analyser = analysers[userId];
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        canvasCtx.fillStyle = '#f1f5f9';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate average for each of the 5 bars
        const barCount = 5;
        const samplesPerBar = Math.floor(bufferLength / barCount);
        
        for (let i = 0; i < barCount; i++) {
            let sum = 0;
            for (let j = 0; j < samplesPerBar; j++) {
                sum += dataArray[i * samplesPerBar + j];
            }
            const average = sum / samplesPerBar;
            const barHeight = (average / 255) * canvas.height;

            const barWidth = canvas.width / barCount - 2;
            const x = i * (barWidth + 2);
            
            canvasCtx.fillStyle = `rgb(59, 130, 246)`;
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        }
    }

    draw();
}

// Toggle self mute
function toggleSelfMute() {
    if (localStream) {
        isMuted = !isMuted;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !isMuted;
        });
        
        // Update UI
        const selfCard = document.getElementById(`participant-${socket.id}`);
        if (selfCard) {
            const micStatus = selfCard.querySelector('.mic-status');
            const muteButton = selfCard.querySelector('.mute-button');
            micStatus.classList.toggle('active', !isMuted);
            muteButton.textContent = isMuted ? 'Unmute' : 'Mute';
            muteButton.classList.toggle('muted', isMuted);
        }
    }
}

// Create room
createRoomBtn.addEventListener('click', () => {
    if (!userName) {
        alert('Please set your name first!');
        return;
    }
    const roomName = roomNameInput.value.trim();
    if (roomName) {
        socket.emit('createRoom', roomName);
    }
});

// Join room
function joinRoom(roomName) {
    if (!userName) {
        alert('Please set your name first!');
        return;
    }
    if (currentRoom) {
        leaveRoom();
    }
    socket.emit('joinRoom', roomName);
}

// Leave room
function leaveRoom() {
    if (currentRoom) {
        socket.emit('leaveRoom', currentRoom);
        Object.values(peerConnections).forEach(pc => pc.close());
        peerConnections = {};
        activeRoom.classList.add('hidden');
        currentRoom = null;
    }
}

leaveRoomBtn.addEventListener('click', leaveRoom);

// Socket event handlers
socket.on('roomCreated', (roomName) => {
    currentRoom = roomName;
    currentRoomName.textContent = roomName;
    activeRoom.classList.remove('hidden');
    updateRoomList();
});

socket.on('roomJoined', (roomName) => {
    currentRoom = roomName;
    currentRoomName.textContent = roomName;
    activeRoom.classList.remove('hidden');
});

socket.on('roomList', (rooms) => {
    roomList.innerHTML = '';
    rooms.forEach(room => {
        const roomElement = document.createElement('div');
        roomElement.className = 'room-item';
        roomElement.innerHTML = `
            <span>${room}</span>
            <button onclick="joinRoom('${room}')">Join</button>
        `;
        roomList.appendChild(roomElement);
    });
});

socket.on('userJoined', async (data) => {
    const peerConnection = createPeerConnection(data.userId);
    peerConnections[data.userId] = peerConnection;

    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', {
        target: data.userId,
        sdp: offer
    });

    // Add participant UI
    addParticipantUI(data.userId, data.userName);
});

socket.on('offer', async (data) => {
    const peerConnection = createPeerConnection(data.target);
    peerConnections[data.target] = peerConnection;

    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', {
        target: data.target,
        sdp: answer
    });

    addParticipantUI(data.target, data.userName);
});

socket.on('answer', async (data) => {
    const peerConnection = peerConnections[data.target];
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
});

socket.on('ice-candidate', async (data) => {
    const peerConnection = peerConnections[data.target];
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

socket.on('userLeft', (userId) => {
    if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
    }
    if (analysers[userId]) {
        delete analysers[userId];
    }
    removeParticipantUI(userId);
});

// UI Helper functions
function addParticipantUI(userId, name) {
    const participantElement = document.createElement('div');
    participantElement.className = 'participant-card';
    participantElement.id = `participant-${userId}`;
    
    const isSelf = userId === socket.id;
    const muteButtonText = isSelf ? (isMuted ? 'Unmute' : 'Mute') : 'Mute';
    const muteButtonClass = isSelf && isMuted ? 'mute-button muted' : 'mute-button';
    
    participantElement.innerHTML = `
        <div class="participant-info">
            <span class="participant-name">${name || 'User ' + userId.slice(0, 6)}</span>
            <div class="mic-controls">
                <div class="mic-status ${isSelf ? (isMuted ? '' : 'active') : 'active'}"></div>
                <button class="${muteButtonClass}" onclick="${isSelf ? 'toggleSelfMute()' : `toggleMute('${userId}')`}">${muteButtonText}</button>
            </div>
        </div>
        <canvas id="wave-${userId}" class="audio-wave" width="300" height="40"></canvas>
        <audio id="audio-${userId}" autoplay></audio>
    `;
    participants.appendChild(participantElement);
}

function removeParticipantUI(userId) {
    const participantElement = document.getElementById(`participant-${userId}`);
    if (participantElement) {
        participantElement.remove();
    }
}

function toggleMute(userId) {
    const audioElement = document.getElementById(`audio-${userId}`);
    const muteButton = document.querySelector(`#participant-${userId} .mute-button`);
    const micStatus = document.querySelector(`#participant-${userId} .mic-status`);
    
    if (audioElement) {
        audioElement.muted = !audioElement.muted;
        muteButton.textContent = audioElement.muted ? 'Unmute' : 'Mute';
        muteButton.classList.toggle('muted', audioElement.muted);
        micStatus.classList.toggle('active', !audioElement.muted);
    }
}

function updateRoomList() {
    socket.emit('getRoomList');
}

// Initialize the app
initializeMedia();
updateRoomList(); 