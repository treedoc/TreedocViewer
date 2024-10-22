let context = new (window.AudioContext || window.webkitAudioContext)();
let intervalId;
let isBeeping = false;

function playBeep() {
    let oscillator = context.createOscillator();
    oscillator.type = 'sine'; // You can change the type (sine, square, triangle, etc.)
    oscillator.frequency.setValueAtTime(440, context.currentTime); // Frequency in Hertz (440Hz is an A4 note)
    
    let gainNode = context.createGain();
    gainNode.gain.setValueAtTime(0.1, context.currentTime); // Volume control
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1); // Play beep for 100ms
}

function toggleBeeping() {
    if (!isBeeping) {
        intervalId = setInterval(playBeep, 1000);
        document.getElementById("toggleBeep").innerText = "Stop Beeping";
        isBeeping = true;
    } else {
        clearInterval(intervalId);
        document.getElementById("toggleBeep").innerText = "Start Beeping";
        isBeeping = false;
    }
}

document.getElementById("toggleBeep").addEventListener("click", toggleBeeping);
