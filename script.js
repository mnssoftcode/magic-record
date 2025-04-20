let mediaRecorder;
let recordedChunks = [];
let stream;
let isRecording = false;
let isMirrored = false;
let isPaused = false;
let isTorchOn = false;
let isMicEnabled = false;
let videoTrack;
let audioTrack;
let recordingStartTime;
let recordingTimer;

const videoElement = document.getElementById('videoElement');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const pauseBtn = document.getElementById('pauseBtn');
const cameraSelect = document.getElementById('cameraSelect');
const recordingStatus = document.getElementById('recordingStatus');
const mirrorBtn = document.getElementById('mirrorBtn');
const torchBtn = document.getElementById('torchBtn');
const micBtn = document.getElementById('micBtn');
const recordingTime = document.getElementById('recordingTime');
const permissionOverlay = document.getElementById('permissionOverlay');
const requestPermissionBtn = document.getElementById('requestPermissionBtn');
const contentToggle = document.getElementById('contentToggle');
const studyBlog = document.getElementById('studyBlog');
const mainContent = document.getElementById('mainContent');
const backgroundIndicator = document.getElementById('backgroundIndicator');
let isBackgroundRecording = false;

// Check if device is mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Function to get supported MIME type
function getSupportedMIME() {
    const types = [
        'video/mp4;codecs=hvc1', // HEVC/H.265
        'video/mp4;codecs=avc1', // H.264 (fallback)
        'video/webm;codecs=vp9', // VP9 (fallback)
        'video/webm;codecs=vp8'  // VP8 (fallback)
    ];

    for (let type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            console.log('Using MIME type:', type);
            return type;
        }
    }
    return 'video/mp4'; // Default fallback
}

// Function to update torch button state
function updateTorchButton() {
    if (!videoTrack) return;
    
    const capabilities = videoTrack.getCapabilities();
    const hasTorch = capabilities.torch !== undefined;
    
    const torchBtn = document.getElementById('torchBtn');
    if (torchBtn) {
        torchBtn.style.display = hasTorch ? 'flex' : 'none';
        torchBtn.disabled = !hasTorch;
        torchBtn.innerHTML = '<i class="fas fa-lightbulb"></i>';
    }
}

async function toggleTorch() {
    if (!videoTrack) return;
    
    const capabilities = videoTrack.getCapabilities();
    if (!capabilities.torch) return;
    
    if (!isTorchOn) {
        const confirmTurnOn = confirm('Are you sure you want to turn on the torch? This may drain your battery faster.');
        if (!confirmTurnOn) return;
    }
    
    try {
        await videoTrack.applyConstraints({
            advanced: [{ torch: !isTorchOn }]
        });
        isTorchOn = !isTorchOn;
        const torchBtn = document.getElementById('torchBtn');
        if (torchBtn) {
            torchBtn.classList.toggle('active', isTorchOn);
        }
    } catch (error) {
        console.error('Error toggling torch:', error);
        showError('Error toggling torch. Your device may not support this feature.');
    }
}

function togglePause() {
    if (!mediaRecorder) return;

    if (isPaused) {
        mediaRecorder.resume();
        isPaused = false;
        pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        recordingStatus.textContent = 'Recording...';
        
        // Resume timer
        recordingStartTime = Date.now() - (Date.now() - recordingStartTime);
        recordingTimer = setInterval(updateRecordingTime, 1000);
    } else {
        mediaRecorder.pause();
        isPaused = true;
        pauseBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
        recordingStatus.textContent = 'Paused';
        
        // Pause timer
        clearInterval(recordingTimer);
    }
}

function handleOrientationChange() {
    const orientation = window.orientation;
    if (orientation === 90 || orientation === -90) {
        videoElement.style.transform = isMirrored ? 'rotate(90deg) scaleX(-1)' : 'rotate(90deg)';
    } else {
        videoElement.style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
    }
}

function toggleMirror() {
    isMirrored = !isMirrored;
    if (isMirrored) {
        videoElement.classList.add('mirrored');
        mirrorBtn.classList.add('active');
    } else {
        videoElement.classList.remove('mirrored');
        mirrorBtn.classList.remove('active');
    }
}

function showError(message) {
    recordingStatus.textContent = message;
    recordingStatus.style.color = 'red';
    setTimeout(() => {
        recordingStatus.textContent = 'Not Recording';
        recordingStatus.style.color = 'var(--text-color)';
    }, 3000);
}

async function toggleMicrophone() {
    try {
        if (isMicEnabled) {
            // Disable microphone
            if (audioTrack) {
                audioTrack.enabled = false;
            }
            isMicEnabled = false;
            micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            micBtn.classList.remove('active');
        } else {
            // Enable microphone
            if (audioTrack) {
                audioTrack.enabled = true;
            } else {
                // Request microphone access
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioTrack = audioStream.getAudioTracks()[0];
                stream.addTrack(audioTrack);
            }
            isMicEnabled = true;
            micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            micBtn.classList.add('active');
        }
    } catch (error) {
        console.error('Error toggling microphone:', error);
        showError('Error accessing microphone. Please check your permissions.');
    }
}

async function setupCamera(facingMode) {
    try {
        // Store current recording state
        const wasRecording = isRecording;
        const wasPaused = isPaused;
        
        // If recording, pause it first
        if (wasRecording && !wasPaused) {
            mediaRecorder.pause();
            isPaused = true;
            clearInterval(recordingTimer);
        }

        // Stop existing stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        const constraints = {
            video: {
                facingMode: facingMode || 'environment', // Default to back camera
                width: { ideal: isMobile ? 1280 : 1920 },
                height: { ideal: isMobile ? 720 : 1080 }
            },
            audio: false // Start with audio disabled
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        videoTrack = stream.getVideoTracks()[0];

        // Update torch button state after a short delay to ensure video track is ready
        setTimeout(updateTorchButton, 500);

        // Apply mirror effect if enabled
        if (isMirrored) {
            videoElement.classList.add('mirrored');
        } else {
            videoElement.classList.remove('mirrored');
        }

        // Handle orientation changes on mobile
        if (isMobile) {
            handleOrientationChange();
            window.addEventListener('orientationchange', handleOrientationChange);
        }

        // If was recording, restart recording with new stream
        if (wasRecording) {
            const mimeType = getSupportedMIME();
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                videoBitsPerSecond: isMobile ? 2500000 : 5000000,
                audioBitsPerSecond: isMicEnabled ? 128000 : 0
            });

            recordedChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: mimeType });
                const filename = `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
                downloadVideo(blob, filename);
                recordedChunks = [];
                
                clearInterval(recordingTimer);
                if (recordingTime) {
                    recordingTime.textContent = '00:00:00';
                }
            };

            mediaRecorder.start(1000);
            isRecording = true;
            isPaused = wasPaused;
            
            if (!wasPaused) {
                // Resume timer if not paused
                recordingStartTime = Date.now() - (Date.now() - recordingStartTime);
                recordingTimer = setInterval(updateRecordingTime, 1000);
                recordingStatus.textContent = 'Recording...';
            } else {
                recordingStatus.textContent = 'Paused';
            }
        }
    } catch (error) {
        console.error('Error accessing camera:', error);
        showError('Error accessing camera. Please make sure you have granted camera permissions.');
    }
}

// Function to download video
function downloadVideo(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// Function to update recording time
function updateRecordingTime() {
    if (!recordingStartTime) return;
    
    const currentTime = Date.now();
    const elapsedTime = Math.floor((currentTime - recordingStartTime) / 1000);
    const hours = Math.floor(elapsedTime / 3600);
    const minutes = Math.floor((elapsedTime % 3600) / 60);
    const seconds = elapsedTime % 60;
    
    if (recordingTime) {
        recordingTime.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Function to check and request permissions
async function checkPermissions() {
    try {
        // Check camera permission
        const cameraPermission = await navigator.permissions.query({ name: 'camera' });
        // Check microphone permission
        const micPermission = await navigator.permissions.query({ name: 'microphone' });

        if (cameraPermission.state === 'granted' && micPermission.state === 'granted') {
            permissionOverlay.style.display = 'none';
            await setupCamera('user');
        } else {
            permissionOverlay.style.display = 'flex';
        }

        // Listen for permission changes
        cameraPermission.onchange = micPermission.onchange = () => {
            if (cameraPermission.state === 'granted' && micPermission.state === 'granted') {
                permissionOverlay.style.display = 'none';
                setupCamera('user');
            } else {
                permissionOverlay.style.display = 'flex';
            }
        };
    } catch (error) {
        console.error('Error checking permissions:', error);
        permissionOverlay.style.display = 'flex';
    }
}

// Function to request permissions
async function requestPermissions() {
    try {
        const constraints = {
            video: {
                facingMode: 'user',
                width: { ideal: isMobile ? 1280 : 1920 },
                height: { ideal: isMobile ? 720 : 1080 }
            },
            audio: true
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        permissionOverlay.style.display = 'none';
        await setupCamera('user');
    } catch (error) {
        console.error('Error requesting permissions:', error);
        showError('Please allow camera and microphone access to use this app.');
    }
}

function toggleContent() {
    studyBlog.classList.toggle('active');
    mainContent.classList.toggle('hidden');
    
    // Update button text based on current view
    if (studyBlog.classList.contains('active')) {
        contentToggle.innerHTML = '<i class="fas fa-exchange-alt"></i> Switch';
    } else {
        contentToggle.innerHTML = '<i class="fas fa-exchange-alt"></i> Show Study Blog';
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    checkPermissions();
    requestPermissionBtn.addEventListener('click', requestPermissions);
    micBtn.addEventListener('click', toggleMicrophone);
    contentToggle.addEventListener('click', toggleContent);
    
    // Add event listeners for recording buttons
    startBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
    pauseBtn.addEventListener('click', togglePause);
    mirrorBtn.addEventListener('click', toggleMirror);
    torchBtn.addEventListener('click', toggleTorch);
    
    // Set default camera to back camera and update select
    cameraSelect.value = 'environment';
    
    // Add event listener for camera selection
    cameraSelect.addEventListener('change', () => {
        const facingMode = cameraSelect.value;
        setupCamera(facingMode);
    });
});

// Request wake lock to prevent device from sleeping
let wakeLock = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock was released');
                // Try to reacquire wake lock if still recording
                if (isRecording) {
                    requestWakeLock();
                }
            });
        }
    } catch (err) {
        console.error('Error requesting wake lock:', err);
        // Retry after a delay if still recording
        if (isRecording) {
            setTimeout(requestWakeLock, 1000);
        }
    }
}

// Handle visibility changes
document.addEventListener('visibilitychange', async () => {
    if (document.hidden && isRecording) {
        isBackgroundRecording = true;
        backgroundIndicator.classList.add('active');
        await requestWakeLock();
        
        // Ensure recording continues
        if (mediaRecorder && mediaRecorder.state === 'paused') {
            mediaRecorder.resume();
        }
    } else {
        isBackgroundRecording = false;
        backgroundIndicator.classList.remove('active');
    }
});

// Handle page unload
window.addEventListener('beforeunload', (e) => {
    if (isRecording) {
        e.preventDefault();
        e.returnValue = '';
        return 'Recording is in progress. Are you sure you want to leave?';
    }
});

// Modify startRecording function
async function startRecording() {
    try {
        if (!stream) {
            await setupCamera('user');
        }

        const mimeType = getSupportedMIME();
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            videoBitsPerSecond: isMobile ? 2500000 : 5000000,
            audioBitsPerSecond: isMicEnabled ? 128000 : 0
        });

        recordedChunks = [];
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
                // Save chunks periodically to prevent memory issues
                if (recordedChunks.length > 10) {
                    const blob = new Blob(recordedChunks, { type: mimeType });
                    const filename = `recording-part-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
                    downloadVideo(blob, filename);
                    recordedChunks = [];
                }
            }
        };

        mediaRecorder.onstop = () => {
            if (recordedChunks.length > 0) {
                const blob = new Blob(recordedChunks, { type: mimeType });
                const filename = `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
                downloadVideo(blob, filename);
                recordedChunks = [];
            }
            
            clearInterval(recordingTimer);
            if (recordingTime) {
                recordingTime.textContent = '00:00:00';
            }
        };

        mediaRecorder.start(1000);
        isRecording = true;
        recordingStartTime = Date.now();
        recordingTimer = setInterval(updateRecordingTime, 1000);
        recordingStatus.textContent = 'Recording...';
        
        // Request wake lock when starting recording
        await requestWakeLock();
        
        // Update UI
        startBtn.disabled = true;
        stopBtn.disabled = false;
        pauseBtn.disabled = false;
    } catch (error) {
        console.error('Error starting recording:', error);
        showError('Error starting recording. Please check your camera permissions.');
    }
}

// Modify stopRecording function
function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        isPaused = false;
        recordingStatus.textContent = 'Ready';
        
        // Release wake lock when stopping recording
        if (wakeLock) {
            wakeLock.release();
            wakeLock = null;
        }
        
        // Update UI
        startBtn.disabled = false;
        stopBtn.disabled = true;
        pauseBtn.disabled = true;
        backgroundIndicator.classList.remove('active');
    }
}

// Add periodic wake lock check
setInterval(() => {
    if (isRecording && (!wakeLock || wakeLock.released)) {
        requestWakeLock();
    }
}, 30000); // Check every 30 seconds
