 
        // Socket state management - 3 sockets only
        let sockets = [
            { id: 1, name: "Lamp", active: false, power: 0, priority: "general", target: 5.0, limit: 100 },
            { id: 2, name: "Charger", active: false, power: 0, priority: "general", target: 10.0, limit: 100 },
            { id: 3, name: "TV", active: false, power: 0, priority: "priority", target: 50.0, limit: 100 }
        ];

        // Voice Control Variables
        let isListening = false;
        let recognition = null;

        // Theme management
        let isDarkTheme = false;
        let currentTimeRange = 'daily';
        let consumptionChart = null;
        
        // Auto Turn Off settings
        let autoTurnOffEnabled = false;
        let autoTurnOffOption = 'priority';

        // Web Bluetooth variables
        let bluetoothDevice = null;
        let bluetoothCharacteristic = null;
        let isBluetoothConnected = false;

        // Home/Away status - Start in Home mode by default
        let userIsHome = true;

        // Energy tracking - Fixed calculations
        let totalEnergyConsumed = 0;
        let totalEnergySaved = 0;
        let co2Avoided = 0;
        let treesSaved = 0;
        let lastUpdateTime = Date.now();

        // Simulation variables
        let simulateWithTargets = false;
        const SIM_TICK_MS = 600;

        // Real-time consumption data
        let realTimeData = {
            daily: {
                labels: ['12AM', '2AM', '4AM', '6AM', '8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM', '10PM'],
                data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                peak: 0,
                average: 0,
                total: 0,
                cost: 0
            },
            weekly: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                data: [0, 0, 0, 0, 0, 0, 0],
                peak: 0,
                average: 0,
                total: 0,
                cost: 0
            },
            monthly: {
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                data: [0, 0, 0, 0],
                peak: 0,
                average: 0,
                total: 0,
                cost: 0
            }
        };

        // Voice Control Functions
        function initVoiceControl() {
            // Check if browser supports speech recognition
            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                document.getElementById('voiceStatus').textContent = 'Voice control not supported in this browser';
                document.getElementById('voiceControlBtn').disabled = true;
                return;
            }

            // Initialize speech recognition
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onstart = function() {
                isListening = true;
                document.getElementById('voiceControlBtn').classList.add('listening');
                document.getElementById('voiceStatus').textContent = 'Listening... Speak now';
            };

            recognition.onresult = function(event) {
                const transcript = event.results[0][0].transcript.toLowerCase();
                document.getElementById('voiceStatus').textContent = `Heard: "${transcript}"`;
                processVoiceCommand(transcript);
            };

            recognition.onerror = function(event) {
                console.error('Speech recognition error:', event.error);
                document.getElementById('voiceStatus').textContent = `Error: ${event.error}`;
                stopListening();
            };

            recognition.onend = function() {
                stopListening();
            };
        }

        function toggleVoiceControl() {
            if (!recognition) {
                initVoiceControl();
            }

            if (isListening) {
                stopListening();
            } else {
                startListening();
            }
        }

        function startListening() {
            try {
                recognition.start();
            } catch (error) {
                console.error('Error starting speech recognition:', error);
                document.getElementById('voiceStatus').textContent = 'Error starting voice recognition';
            }
        }

        function stopListening() {
            isListening = false;
            document.getElementById('voiceControlBtn').classList.remove('listening');
            document.getElementById('voiceStatus').textContent = 'Click mic to speak';
            
            try {
                recognition.stop();
            } catch (error) {
                // Ignore stop errors
            }
        }

        function processVoiceCommand(transcript) {
            console.log('Processing voice command:', transcript);
            
            // Show command feedback console.log
            showCommandFeedback(transcript);
            
            // Normalize the transcript
            const normalized = transcript.toLowerCase().trim();
            
            // Check for multiple commands (separated by "and", "then", comma, or just multiple statements)
            const commandSeparators = /\s+(and|then|,)\s+|\.\s+|\s+\./gi;
            const commands = normalized.split(commandSeparators).filter(cmd => cmd.trim().length > 0);
            
            let results = [];
            
            if (commands.length > 1) {
                // Process multiple commands
                document.getElementById('voiceStatus').textContent = `Processing ${commands.length} commands...`;
                
                commands.forEach((command, index) => {
                    const result = processSingleCommand(command.trim());
                    if (result) {
                        results.push(result);
                    }
                });
                
                if (results.length > 0) {
                    document.getElementById('voiceStatus').textContent = `Executed ${results.length} commands`;
                }
            } else {
                // Process single command
                processSingleCommand(normalized);
            }
        }

                function processSingleCommand(command) {
            console.log('Processing single command:', command);

            // --- Voice verification for single "turn off" ---
const normalized = command.toLowerCase().trim();
if (normalized === "turn off" || normalized === "turn of") {
    document.getElementById('voiceStatus').textContent = "Analyzing speaker...";
    console.log("Voice verification triggered for 'turn off'...");

    // record 2-second sample
    recordVoiceSample().then(blob => {
        const formData = new FormData();
        formData.append("audio", blob, "input.wav");

        fetch("http://127.0.0.1:5000/identify", {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            console.log("Speaker identified:", data);
            const user = data.speaker;
            if (user === "unknown") {
                document.getElementById('voiceStatus').textContent = "Unrecognized voice. Command rejected.";
                return;
            }

            if (user === "toshit") {
                document.getElementById('voiceStatus').textContent = "Recognized Toshit. Turning off Lamp.";
                controlSocketByName("lamp", false);
            } else if (user === "advait") {
                document.getElementById('voiceStatus').textContent = "Recognized Advait. Turning off Charger.";
                controlSocketByName("charger", false);
            } else {
                document.getElementById('voiceStatus').textContent = `Detected ${user}, but no mapped device.`;
            }
        })
        .catch(err => {
            console.error("Voice verification error:", err);
            document.getElementById('voiceStatus').textContent = "Error verifying voice.";
        });
    });
    return;
}
           // --- Voice verification for single "turn on" ---
if (normalized === "turn on") {
    document.getElementById('voiceStatus').textContent = "Analyzing speaker...";
    console.log("Voice verification triggered for 'turn on'...");

    recordVoiceSample().then(blob => {
        const formData = new FormData();
        formData.append("audio", blob, "input.wav");

        fetch("http://127.0.0.1:5000/identify", {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            console.log("Speaker identified:", data);
            const user = data.speaker;
            if (user === "unknown") {
                document.getElementById('voiceStatus').textContent = "Unrecognized voice. Command rejected.";
                return;
            }

            if (user === "toshit") {
                document.getElementById('voiceStatus').textContent = "Recognized Toshit. Turning on Lamp.";
                controlSocketByName("lamp", true);
            } else if (user === "advait") {
                document.getElementById('voiceStatus').textContent = "Recognized Advait. Turning on Charger.";
                controlSocketByName("charger", true);
            } else {
                document.getElementById('voiceStatus').textContent = `Detected ${user}, but no mapped device.`;
            }
        })
        .catch(err => {
            console.error("Voice verification error:", err);
            document.getElementById('voiceStatus').textContent = "Error verifying voice.";
        });
    });
    return;
}
             async function recordVoiceSample() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const chunks = [];

    return new Promise(resolve => {
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/wav' });
            resolve(blob);
        };
        mediaRecorder.start();
        setTimeout(() => mediaRecorder.stop(), 2000);
    });
}

            
            // First, fix common speech recognition errors
            let cleanedCommand = command
                .replace(/\bof\b/gi, 'off')  // Replace "of" with "off"
                .replace(/\bdevice off\b/gi, 'turn off')
                .replace(/\bdevices off\b/gi, 'turn off');
            
            console.log('Cleaned command:', cleanedCommand);
            
            // Command patterns to match:
            // - "socket [number] on/off"
            // - "turn on/off socket [number]"  
            // - "on/off [socket name]"
            // - "turn on/off [socket name]"
            // - "[socket name] on/off"
            
            // Pattern 1: "socket X on/off"
            const socketNumberPattern = /socket\s+(\d+)\s+(on|off)/i;
            const socketNumberMatch = cleanedCommand.match(socketNumberPattern);
            if (socketNumberMatch) {
                const socketId = parseInt(socketNumberMatch[1]);
                const action = socketNumberMatch[2];
                return controlSocketById(socketId, action === 'on');
            }
            
            // Pattern 2: "turn on/off socket X"
            const turnSocketPattern = /turn\s+(on|off)\s+socket\s+(\d+)/i;
            const turnSocketMatch = cleanedCommand.match(turnSocketPattern);
            if (turnSocketMatch) {
                const action = turnSocketMatch[1];
                const socketId = parseInt(turnSocketMatch[2]);
                return controlSocketById(socketId, action === 'on');
            }
            
            // Pattern 3: "on/off [socket name]"
            const socketNamePattern = /(on|off)\s+(.+)/i;
            const socketNameMatch = cleanedCommand.match(socketNamePattern);
            if (socketNameMatch) {
                const action = socketNameMatch[1];
                const socketName = socketNameMatch[2].trim();
                return controlSocketByName(socketName, action === 'on');
            }
            
            // Pattern 4: "turn on/off [socket name]"
            const turnNamePattern = /turn\s+(on|off)\s+(.+)/i;
            const turnNameMatch = cleanedCommand.match(turnNamePattern);
            if (turnNameMatch) {
                const action = turnNameMatch[1];
                const socketName = turnNameMatch[2].trim();
                return controlSocketByName(socketName, action === 'on');
            }
            
            // Pattern 5: Simple "on/off X" 
            const simplePattern = /(on|off)\s+(\d+)/i;
            const simpleMatch = cleanedCommand.match(simplePattern);
            if (simpleMatch) {
                const action = simpleMatch[1];
                const socketId = parseInt(simpleMatch[2]);
                return controlSocketById(socketId, action === 'on');
            }
            
            // Pattern 6: "[socket name] on/off" (reversed order)
            const reversedPattern = /(.+)\s+(on|off)/i;
            const reversedMatch = cleanedCommand.match(reversedPattern);
            if (reversedMatch) {
                const socketName = reversedMatch[1].trim();
                const action = reversedMatch[2];
                return controlSocketByName(socketName, action === 'on');
            }
            
            // Pattern 7: "switch on/off [socket name]"
            const switchPattern = /switch\s+(on|off)\s+(.+)/i;
            const switchMatch = cleanedCommand.match(switchPattern);
            if (switchMatch) {
                const action = switchMatch[1];
                const socketName = switchMatch[2].trim();
                return controlSocketByName(socketName, action === 'on');
            }
            
            // Pattern 8: "activate/deactivate [socket name]"
            const activatePattern = /(activate|deactivate)\s+(.+)/i;
            const activateMatch = cleanedCommand.match(activatePattern);
            if (activateMatch) {
                const action = activateMatch[1];
                const socketName = activateMatch[2].trim();
                return controlSocketByName(socketName, action === 'activate');
            }
            
            // Pattern 9: "power on/off [socket name]"
            const powerPattern = /power\s+(on|off)\s+(.+)/i;
            const powerMatch = cleanedCommand.match(powerPattern);
            if (powerMatch) {
                const action = powerMatch[1];
                const socketName = powerMatch[2].trim();
                return controlSocketByName(socketName, action === 'on');
            }
            
            // If no patterns matched
            document.getElementById('voiceStatus').textContent = 'Command not recognized. Try: "socket 1 on" or "on TV" or "lamp on and tv off"';
            return null;
        }

        function controlSocketById(socketId, turnOn) {
            if (socketId >= 1 && socketId <= sockets.length) {
                const socket = sockets[socketId - 1];
                
                // Check if we're in away mode and auto turn off is enabled
                if (!userIsHome && autoTurnOffEnabled) {
                    if (autoTurnOffOption === 'all') {
                        const message = `Cannot toggle sockets in Away Mode with "Turn Off All Sockets" enabled`;
                        document.getElementById('voiceStatus').textContent = message;
                        return { success: false, message };
                    } else if (autoTurnOffOption === 'priority' && socket.priority !== 'priority') {
                        const message = `Cannot toggle non-priority sockets in Away Mode`;
                        document.getElementById('voiceStatus').textContent = message;
                        return { success: false, message };
                    }
                }
                
                if (socket.active !== turnOn) {
                    // Use the existing toggleSocket function to handle the actual toggling
                    toggleSocket(socketId);
                    const message = `Turning ${turnOn ? 'on' : 'off'} ${socket.name}`;
                    document.getElementById('voiceStatus').textContent = message;
                    return { success: true, message };
                } else {
                    const message = `${socket.name} is already ${turnOn ? 'on' : 'off'}`;
                    document.getElementById('voiceStatus').textContent = message;
                    return { success: false, message };
                }
            } else {
                const message = `Socket ${socketId} not found`;
                document.getElementById('voiceStatus').textContent = message;
                return { success: false, message };
            }
        }

        function controlSocketByName(socketName, turnOn) {
            // Try exact match first
            let socket = sockets.find(s => s.name.toLowerCase() === socketName.toLowerCase());
            
            // If no exact match, try partial match
            if (!socket) {
                socket = sockets.find(s => s.name.toLowerCase().includes(socketName.toLowerCase()));
            }
            
            // If still no match, try common variations
            if (!socket) {
                const commonVariations = {
                    'lamp': 'Lamp',
                    'light': 'Lamp',
                    'lights': 'Lamp',
                    'bulb': 'Lamp',
                    'charger': 'Charger',
                    'phone charger': 'Charger',
                    'mobile charger': 'Charger',
                    'tv': 'TV',
                    'television': 'TV',
                    'screen': 'TV',
                    'monitor': 'TV'
                };
                
                const variation = commonVariations[socketName.toLowerCase()];
                if (variation) {
                    socket = sockets.find(s => s.name === variation);
                }
            }
            
            if (socket) {
                // Check if we're in away mode and auto turn off is enabled
                if (!userIsHome && autoTurnOffEnabled) {
                    if (autoTurnOffOption === 'all') {
                        const message = `Cannot toggle sockets in Away Mode with "Turn Off All Sockets" enabled`;
                        document.getElementById('voiceStatus').textContent = message;
                        return { success: false, message };
                    } else if (autoTurnOffOption === 'priority' && socket.priority !== 'priority') {
                        const message = `Cannot toggle non-priority sockets in Away Mode`;
                        document.getElementById('voiceStatus').textContent = message;
                        return { success: false, message };
                    }
                }
                
                if (socket.active !== turnOn) {
                    // Use the existing toggleSocket function to handle the actual toggling
                    toggleSocket(socket.id);
                    const message = `Turning ${turnOn ? 'on' : 'off'} ${socket.name}`;
                    document.getElementById('voiceStatus').textContent = message;
                    return { success: true, message };
                } else {
                    const message = `${socket.name} is already ${turnOn ? 'on' : 'off'}`;
                    document.getElementById('voiceStatus').textContent = message;
                    return { success: false, message };
                }
            } else {
                const message = `Socket "${socketName}" not found. Available: ${sockets.map(s => s.name).join(', ')}`;
                document.getElementById('voiceStatus').textContent = message;
                return { success: false, message };
            }
        }

        function showCommandFeedback(transcript) {
            // Remove any existing feedback
            const existingFeedback = document.querySelector('.voice-command-feedback');
            if (existingFeedback) {
                existingFeedback.remove();
            }
            
            // Create new feedback element
            const feedback = document.createElement('div');
            feedback.className = 'voice-command-feedback';
            feedback.innerHTML = `
                <strong>Command:</strong> "${transcript}"
            `;
            
            // Insert after voice control container
            const voiceContainer = document.querySelector('.voice-control-container');
            voiceContainer.parentNode.insertBefore(feedback, voiceContainer.nextSibling);
            
            // Remove feedback after 3 seconds
            setTimeout(() => {
                feedback.remove();
            }, 3000);
        }

        // Simulation logic
        function simulationTick() {
            if (!simulateWithTargets) return;

            sockets.forEach(s => {
                // ramp rate: fraction of difference applied each tick
                const rampFraction = 0.20; // controls how gradual ramp is
                if (s.active) {
                    // goal is s.target (but limited by s.limit)
                    const goal = Math.min(s.target, s.limit);
                    const diff = goal - s.power;
                    s.power += diff * rampFraction;
                    // apply small jitter around target when near it
                    if (Math.abs(s.power - goal) < 0.5) {
                        const jitterPct = 0.02; // ±2%
                        const jitter = (Math.random() * 2 - 1) * (goal * jitterPct);
                        s.power = Math.max(0, goal + jitter);
                    }
                } else {
                    // discharge towards 0 smoothly
                    s.power += (0 - s.power) * rampFraction;
                    if (s.power < 0.05) s.power = 0;
                }
                // keep a reasonable decimal precision
                s.power = Math.round(s.power * 100) / 100;
            });

            renderSockets();
            updateStats();
            updateImpactStats();
            updateConsumptionData();
        }

        // Start simulation interval
        setInterval(simulationTick, SIM_TICK_MS);

        // Maintenance popup functions
        function renderMaintenanceSockets() {
            const container = document.getElementById('maintenanceSockets');
            if (!container) return;
            container.innerHTML = '';

            sockets.forEach(s => {
                const row = document.createElement('div');
                row.className = 'maint-row';
                row.innerHTML = `
                    <div style="flex:1">
                        <div style="font-weight:700">${escapeHtml(s.name)} <small style="font-weight:600;color:#64748b">(#${s.id})</small></div>
                        <div style="font-size:12px;color:#64748b">Current: <span id="maint-power-${s.id}">${s.power.toFixed(2)}W</span></div>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
                        <div class="maint-controls">
                            <button style="padding:8px 10px;border-radius:10px;border:none;background:${s.active? '#10b981':'#cbd5e1'};color:${s.active? '#fff':'#0f172a'};font-weight:700;cursor:pointer" onclick="toggleSocket(${s.id})">${s.active? 'ON':'OFF'}</button>
                        </div>
                        <div style="display:flex;gap:8px;align-items:center">
                            <input class="maint-input" id="maint-target-${s.id}" type="number" step="0.1" value="${s.target}" />
                            <button style="padding:8px;border-radius:8px;border:none;background:#0ea5e9;color:#fff;cursor:pointer" onclick="applyTarget(${s.id})">Set W</button>
                        </div>
                    </div>
                `;
                container.appendChild(row);
            });
        }

        function applyTarget(id) {
            const el = document.getElementById('maint-target-' + id);
            if (!el) return;
            const v = parseFloat(el.value);
            if (isNaN(v) || v < 0) { alert('Enter valid wattage'); return; }
            const idx = sockets.findIndex(s => s.id === id);
            sockets[idx].target = v;
            // update immediately (simulation will ramp)
            alert('Target set to ' + v + ' W for socket ' + id + '. (Simulation active only when ESP32 connected).');
        }

        function escapeHtml(s) { 
            return (s + '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); 
        }

        // Popup drag functionality
        function makePopupDraggable() {
            const popup = document.getElementById('maintenancePopup');
            const header = document.getElementById('popupHeader');
            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;
            let xOffset = 0;
            let yOffset = 0;

            header.addEventListener("mousedown", dragStart);
            header.addEventListener("touchstart", dragStart);
            document.addEventListener("mouseup", dragEnd);
            document.addEventListener("touchend", dragEnd);
            document.addEventListener("mousemove", drag);
            document.addEventListener("touchmove", drag);

            function dragStart(e) {
                if (e.type === "touchstart") {
                    initialX = e.touches[0].clientX - xOffset;
                    initialY = e.touches[0].clientY - yOffset;
                } else {
                    initialX = e.clientX - xOffset;
                    initialY = e.clientY - yOffset;
                }

                if (e.target === header || header.contains(e.target)) {
                    isDragging = true;
                }
            }

            function dragEnd() {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
            }

            function drag(e) {
                if (isDragging) {
                    e.preventDefault();
                    
                    if (e.type === "touchmove") {
                        currentX = e.touches[0].clientX - initialX;
                        currentY = e.touches[0].clientY - initialY;
                    } else {
                        currentX = e.clientX - initialX;
                        currentY = e.clientY - initialY;
                    }

                    xOffset = currentX;
                    yOffset = currentY;

                    setTranslate(currentX, currentY, popup);
                }
            }

            function setTranslate(xPos, yPos, el) {
                el.style.transform = `translate(${xPos}px, ${yPos}px)`;
            }
        }

        function openMaintenancePopup() {
            const popup = document.getElementById('maintenancePopup');
            popup.classList.add('active');
            renderMaintenanceSockets();
            // Reset position to center
            popup.style.transform = 'translate(-50%, -50%)';
        }

        function closeMaintenancePopup() {
            const popup = document.getElementById('maintenancePopup');
            popup.classList.remove('active');
        }

        // Web Bluetooth functions
        async function connectBluetooth() {
            try {
                console.log('Requesting Bluetooth Device...');
                bluetoothDevice = await navigator.bluetooth.requestDevice({
                    filters: [{ name: 'SmartStrip' }],
                    optionalServices: ['0000ffe0-0000-1000-8000-00805f9b34fb']
                });

                console.log('Connecting to GATT Server...');
                const server = await bluetoothDevice.gatt.connect();
                updateBluetoothStatus(true);

                console.log('Getting Service...');
                const service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');

                console.log('Getting Characteristic...');
                bluetoothCharacteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');

                // Start notifications
                await bluetoothCharacteristic.startNotifications();
                console.log('Notifications started');

                bluetoothCharacteristic.addEventListener('characteristicvaluechanged', handleBluetoothData);

                // Read initial value
                const value = await bluetoothCharacteristic.readValue();
                handleBluetoothData({ target: { value: value } });

                // Send current settings to ESP32
                sendHomeStatus();
                sendAutoTurnOffSettings();
                sendSocketSettings();

                // Start simulation when connected
                simulateWithTargets = true;

                // Handle disconnection
                bluetoothDevice.addEventListener('gattserverdisconnected', () => {
                    console.log('Bluetooth device disconnected');
                    updateBluetoothStatus(false);
                    simulateWithTargets = false;
                });

            } catch (error) {
                console.error('Bluetooth connection failed:', error);
                updateBluetoothStatus(false);
                alert('Failed to connect to SmartStrip. Make sure it is powered on and in range.');
            }
        }

        function handleBluetoothData(event) {
            const value = event.target.value;
            const decoder = new TextDecoder('utf-8');
            const dataString = decoder.decode(value);
            
            
            
            // Parse the power data (format: "32.5,0,56.2") - 3 values now
            const powerValues = dataString.split(',').map(Number);
            
            if (powerValues.length === 3 && !simulateWithTargets) {
                // Update socket data with real values from ESP32 (only if not simulating)
                for (let i = 0; i < 3; i++) {
                    sockets[i].power = powerValues[i];
                    sockets[i].active = powerValues[i] > 0;
                }
                
                // Update UI with real data
                renderSockets();
                updateStats();
                updateImpactStats();
                updateConsumptionData();
            }
        }

        function updateBluetoothStatus(connected) {
            isBluetoothConnected = connected;
            const statusElement = document.getElementById('bluetoothStatus');
            const statusText = document.getElementById('bluetoothStatusText');
            const connectBtn = document.getElementById('bluetoothConnectBtn');
            
            if (connected) {
                statusElement.classList.remove('disconnected');
                statusElement.classList.add('connected');
                statusText.textContent = 'Connected to SmartStrip';
                connectBtn.textContent = 'Disconnect';
                connectBtn.onclick = disconnectBluetooth;
                simulateWithTargets = true;
            } else {
                statusElement.classList.remove('connected');
                statusElement.classList.add('disconnected');
                statusText.textContent = 'Disconnected from ESP32';
                connectBtn.textContent = 'Connect';
                connectBtn.onclick = connectBluetooth;
                simulateWithTargets = false;
                
                // Reset socket data when disconnected
                sockets.forEach(socket => {
                    socket.power = 0;
                    socket.active = false;
                });
                renderSockets();
                updateStats();
            }
        }

        function disconnectBluetooth() {
            if (bluetoothDevice && bluetoothDevice.gatt.connected) {
                bluetoothDevice.gatt.disconnect();
            }
            updateBluetoothStatus(false);
        }

        async function sendSocketCommand(socketId, state) {
            if (!isBluetoothConnected || !bluetoothCharacteristic) {
                console.error('Not connected to Bluetooth device');
                return;
            }
            
            const command = `TOGGLE:${socketId}:${state ? 1 : 0}`;
            const encoder = new TextEncoder('utf-8');
            const data = encoder.encode(command);
            
            try {
                await bluetoothCharacteristic.writeValue(data);
                console.log(`Sent command: ${command}`);
            } catch (error) {
                console.error('Failed to send command:', error);
            }
        }

        async function sendHomeStatus() {
            if (!isBluetoothConnected || !bluetoothCharacteristic) {
                return;
            }
            
            const command = `HOME:${userIsHome ? 1 : 0}`;
            const encoder = new TextEncoder('utf-8');
            const data = encoder.encode(command);
            
            try {
                await bluetoothCharacteristic.writeValue(data);
                console.log(`Sent home status: ${command}`);
            } catch (error) {
                console.error('Failed to send home status:', error);
            }
        }

        async function sendAutoTurnOffSettings() {
            if (!isBluetoothConnected || !bluetoothCharacteristic) {
                return;
            }
            
            const command = `AUTO_OFF:${autoTurnOffEnabled ? 1 : 0}:${autoTurnOffOption}`;
            const encoder = new TextEncoder('utf-8');
            const data = encoder.encode(command);
            
            try {
                await bluetoothCharacteristic.writeValue(data);
                console.log(`Sent auto turn off settings: ${command}`);
            } catch (error) {
                console.error('Failed to send auto turn off settings:', error);
            }
        }

        async function sendSocketSettings() {
            if (!isBluetoothConnected || !bluetoothCharacteristic) {
                return;
            }
            
            // Send priority settings for each socket
            for (let socket of sockets) {
                const command = `PRIORITY:${socket.id}:${socket.priority}`;
                const encoder = new TextEncoder('utf-8');
                const data = encoder.encode(command);
                
                try {
                    await bluetoothCharacteristic.writeValue(data);
                    console.log(`Sent socket priority: ${command}`);
                    // Small delay between commands
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error('Failed to send socket settings:', error);
                }
            }
        }

        function toggleHomeAway() {
            userIsHome = !userIsHome;
            const button = document.getElementById('homeAwayBtn');
            const text = document.getElementById('homeAwayText');
            
            if (userIsHome) {
                button.classList.remove('away');
                text.textContent = 'Home Mode';
            } else {
                button.classList.add('away');
                text.textContent = 'Away Mode';
            }
            
            // Send home status to ESP32
            sendHomeStatus();
            
            // If away and auto turn off is enabled, show notification
            if (!userIsHome && autoTurnOffEnabled) {
                alert('Away mode activated! Auto turn off will manage your sockets.');
            }
        }

        function toggleTheme() {
            isDarkTheme = !isDarkTheme;
            const body = document.body;
            const themeNavIcon = document.getElementById('theme-nav-icon');
            const themeNavText = document.getElementById('theme-nav-text');

            if (isDarkTheme) {
                body.classList.remove('light-theme');
                body.classList.add('dark-theme');
                themeNavIcon.textContent = '☀️';
                themeNavText.textContent = 'Light';
            } else {
                body.classList.remove('dark-theme');
                body.classList.add('light-theme');
                themeNavIcon.textContent = '🌙';
                themeNavText.textContent = 'Dark';
            }

            // Update chart theme if it exists
            if (consumptionChart) {
                updateChartTheme();
            }
        }

        function toggleAutoTurnOff() {
            autoTurnOffEnabled = !autoTurnOffEnabled;
            const toggle = document.getElementById('autoTurnOffToggle');
            const options = document.getElementById('autoTurnOffOptions');
            
            if (autoTurnOffEnabled) {
                toggle.classList.add('on');
                options.classList.add('show');
            } else {
                toggle.classList.remove('on');
                options.classList.remove('show');
            }
            
            // Send settings to ESP32
            sendAutoTurnOffSettings();
        }

        function selectAutoTurnOffOption(option) {
            autoTurnOffOption = option;
            const options = document.querySelectorAll('.auto-turnoff-option');
            
            options.forEach(opt => {
                opt.classList.remove('selected');
            });
            
            event.currentTarget.classList.add('selected');
            
            // Send settings to ESP32 if auto turn off is enabled
            if (autoTurnOffEnabled) {
                sendAutoTurnOffSettings();
            }
        }

        function changeTimeRange(range) {
            currentTimeRange = range;
            
            // Update button states
            document.querySelectorAll('.time-range-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Update chart
            updateConsumptionChart();
        }

        function updateConsumptionData() {
            const now = new Date();
            const currentHour = now.getHours();
            const dataIndex = Math.floor(currentHour / 2);
            
            if (dataIndex >= 0 && dataIndex < realTimeData.daily.data.length) {
                const totalPower = sockets.reduce((sum, socket) => sum + socket.power, 0);
                
                // Update current hour's data (weighted average)
                realTimeData.daily.data[dataIndex] = 
                    0.7 * realTimeData.daily.data[dataIndex] + 0.3 * totalPower;
                
                // Update stats - Changed to INR (₹6 per kWh)
                realTimeData.daily.peak = Math.max(realTimeData.daily.peak, totalPower);
                realTimeData.daily.total = realTimeData.daily.data.reduce((sum, val) => sum + val, 0) / 6; // Convert to kWh
                realTimeData.daily.average = realTimeData.daily.total / (dataIndex + 1) * 6;
                realTimeData.daily.cost = realTimeData.daily.total * 6; // ₹6 per kWh
                
                // Update weekly and monthly data (simplified)
                const dayOfWeek = now.getDay();
                realTimeData.weekly.data[dayOfWeek] = totalPower;
                realTimeData.weekly.peak = Math.max(...realTimeData.weekly.data);
                realTimeData.weekly.total = realTimeData.weekly.data.reduce((sum, val) => sum + val, 0) / 1000;
                realTimeData.weekly.average = realTimeData.weekly.total / 7;
                realTimeData.weekly.cost = realTimeData.weekly.total * 6; // ₹6 per kWh
                
                const weekOfMonth = Math.floor(now.getDate() / 7);
                if (weekOfMonth < 4) {
                    realTimeData.monthly.data[weekOfMonth] = totalPower;
                    realTimeData.monthly.peak = Math.max(...realTimeData.monthly.data);
                    realTimeData.monthly.total = realTimeData.monthly.data.reduce((sum, val) => sum + val, 0) / 1000;
                    realTimeData.monthly.average = realTimeData.monthly.total / 4;
                    realTimeData.monthly.cost = realTimeData.monthly.total * 6; // ₹6 per kWh
                }
                
                // Update chart if on consumption page
                if (document.getElementById('consumption-page').classList.contains('active') && consumptionChart) {
                    consumptionChart.update();
                    updateConsumptionStats();
                }
            }
        }

        function updateConsumptionChart() {
            const ctx = document.getElementById('consumptionChart').getContext('2d');
            const data = realTimeData[currentTimeRange];
            
            // Destroy existing chart
            if (consumptionChart) {
                consumptionChart.destroy();
            }

            // Calculate appropriate max value for Y axis
            const maxDataValue = Math.max(...data.data);
            const suggestedMax = Math.ceil(maxDataValue * 1.2) || 100;

            // Create new chart
            consumptionChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: currentTimeRange === 'daily' ? 'Power (W)' : 'Energy (kWh)',
                        data: data.data,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            titleColor: '#1e293b',
                            bodyColor: '#1e293b',
                            borderColor: '#e2e8f0',
                            borderWidth: 1
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(203, 213, 225, 0.3)'
                            },
                            ticks: {
                                color: 'rgba(100, 116, 139, 0.8)'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            suggestedMax: suggestedMax,
                            grid: {
                                color: 'rgba(203, 213, 225, 0.3)'
                            },
                            ticks: {
                                color: 'rgba(100, 116, 139, 0.8)',
                                maxTicksLimit: 6
                            }
                        }
                    },
                    layout: {
                        padding: {
                            top: 10,
                            bottom: 10
                        }
                    }
                }
            });

            updateConsumptionStats();
            updateChartTheme();
        }

        function updateConsumptionStats() {
            const data = realTimeData[currentTimeRange];
            
            document.getElementById('peakUsage').textContent = 
                currentTimeRange === 'daily' ? `${Math.round(data.peak)}W` : `${data.peak.toFixed(1)}kWh`;
            document.getElementById('avgUsage').textContent = 
                currentTimeRange === 'daily' ? `${Math.round(data.average)}W` : `${data.average.toFixed(1)}kWh`;
            document.getElementById('totalUsage').textContent = `${data.total.toFixed(1)}kWh`;
            document.getElementById('costEstimate').textContent = `₹${data.cost.toFixed(2)}`;

            // Update chart title
            const titles = {
                daily: "Today's Power Consumption",
                weekly: "Weekly Energy Consumption",
                monthly: "Monthly Energy Consumption"
            };
            document.getElementById('chartTitle').textContent = titles[currentTimeRange];
        }

        function updateChartTheme() {
            if (!consumptionChart) return;

            const isDark = document.body.classList.contains('dark-theme');
            const gridColor = isDark ? 'rgba(100, 116, 139, 0.2)' : 'rgba(203, 213, 225, 0.3)';
            const tickColor = isDark ? 'rgba(148, 163, 184, 0.8)' : 'rgba(100, 116, 139, 0.8)';

            consumptionChart.options.scales.x.grid.color = gridColor;
            consumptionChart.options.scales.x.ticks.color = tickColor;
            consumptionChart.options.scales.y.grid.color = gridColor;
            consumptionChart.options.scales.y.ticks.color = tickColor;

            consumptionChart.update();
        }

        function updateImpactStats() {
            // Calculate impact based on actual energy consumption
            const currentTime = Date.now();
            const timeDiff = (currentTime - lastUpdateTime) / 1000 / 3600; // hours
            
            // Calculate current power consumption
            const totalPower = sockets.reduce((sum, socket) => sum + socket.power, 0);
            const energyIncrement = (totalPower * timeDiff) / 1000; // kWh
            
            // Update total energy consumed
            totalEnergyConsumed += energyIncrement;
            
            // Calculate energy saved based on smart features
            // Assume 25% energy savings from smart power management
            const energySavingsRate = 0.25;
            totalEnergySaved += energyIncrement * energySavingsRate;
            
            // CO2 calculations (more realistic)
            // Average CO2 emission factor for India: 0.82 kg CO2 per kWh
            const co2EmissionFactor = 0.82; // kg CO2 per kWh
            co2Avoided = totalEnergySaved * co2EmissionFactor;
            
            // Trees saved calculation
            // One mature tree absorbs approximately 22 kg of CO2 per year
            const co2AbsorbedPerTreePerYear = 22; // kg
            treesSaved = co2Avoided / co2AbsorbedPerTreePerYear;
            
            // Update display
            document.getElementById('energySaved').textContent = Math.round(totalEnergySaved * 1000); // Convert to Wh
            document.getElementById('co2Avoided').textContent = co2Avoided.toFixed(2);
            document.getElementById('treesSaved').textContent = treesSaved.toFixed(2);
            
            lastUpdateTime = currentTime;
        }

        // Initialize the app
        function initApp() {
            renderSockets();
            updateStats();
            loadSettings();
            updateConsumptionChart();
            updateImpactStats();
            makePopupDraggable();
            
            // Set up Bluetooth connection button
            document.getElementById('bluetoothConnectBtn').onclick = connectBluetooth;
            
            // Initialize voice control
            initVoiceControl();
            
            // Auto-update consumption data every 5 seconds
            setInterval(() => {
                if (isBluetoothConnected) {
                    updateConsumptionData();
                }
            }, 5000);

            // Maintenance: update power displays on tick and sync with home page
            setInterval(() => {
                sockets.forEach(s => {
                    const el = document.getElementById('maint-power-' + s.id);
                    if (el) el.textContent = s.power.toFixed(2) + 'W';
                    
                    // Sync home page power values
                    const homePowerEl = document.getElementById('power-value-' + s.id);
                    if (homePowerEl) homePowerEl.textContent = s.power.toFixed(1) + 'W';
                    
                    // Sync home page toggle states
                    const homeToggleEl = document.querySelector(`.toggle-switch[onclick="toggleSocket(${s.id})"]`);
                    if (homeToggleEl) {
                        if (s.active && !homeToggleEl.classList.contains('on')) {
                            homeToggleEl.classList.add('on');
                            const powerInfoEl = document.getElementById('power-info-' + s.id);
                            if (powerInfoEl) powerInfoEl.classList.add('visible');
                        } else if (!s.active && homeToggleEl.classList.contains('on')) {
                            homeToggleEl.classList.remove('on');
                            const powerInfoEl = document.getElementById('power-info-' + s.id);
                            if (powerInfoEl) powerInfoEl.classList.remove('visible');
                        }
                    }
                });
            }, 700);

            // Press-and-hold title to open maintenance popup (5s)
            const title = document.getElementById('pageTitle');
            let holdTimer = null;
            title.addEventListener('pointerdown', () => {
                holdTimer = setTimeout(() => {
                    openMaintenancePopup();
                }, 5000);
            });
            title.addEventListener('pointerup', () => { 
                if (holdTimer) { 
                    clearTimeout(holdTimer); 
                    holdTimer = null; 
                } 
            });
            title.addEventListener('pointerleave', () => { 
                if (holdTimer) { 
                    clearTimeout(holdTimer); 
                    holdTimer = null; 
                } 
            });
        }

        // Load settings from socket data
        function loadSettings() {
            sockets.forEach(socket => {
                const nameInput = document.querySelector(`.socket-name-input[data-socket="${socket.id}"]`);
                const prioritySelect = document.querySelector(`.priority-select[data-socket="${socket.id}"]`);
                const limitInput = document.querySelector(`.socket-limit-input[data-socket="${socket.id}"]`);
                
                if (nameInput) {
                    nameInput.value = socket.name;
                }
                if (prioritySelect) {
                    prioritySelect.value = socket.priority;
                }
                if (limitInput) {
                    limitInput.value = socket.limit;
                }
            });
        }

        // Render sockets grid with proper names from settings
        function renderSockets() {
            const grid = document.getElementById('socketsGrid');
            grid.innerHTML = '';

            sockets.forEach(socket => {
                const socketElement = document.createElement('div');
                socketElement.className = 'socket-item';
                socketElement.innerHTML = `
                    <div class="toggle-container">
                        ${socket.priority === 'priority' ? '<div class="socket-priority-badge">PRIORITY</div>' : ''}
                        <div class="socket-name">${socket.name}</div>
                        <button class="toggle-switch ${socket.active ? 'on' : ''}" 
                                onclick="toggleSocket(${socket.id})">
                            <div class="toggle-knob">
                                <div class="toggle-icon">⚡</div>
                            </div>
                        </button>
                        <div class="power-info ${socket.active ? 'visible' : ''}" id="power-info-${socket.id}">
                            <span class="power-value" id="power-value-${socket.id}">${socket.power.toFixed(1)}W</span>
                        </div>
                    </div>
                `;
                grid.appendChild(socketElement);
            });
        }

        // Toggle socket state - now updates both maintenance and home pages
        function toggleSocket(socketId) {
            const socketIndex = socketId - 1;
            const socket = sockets[socketIndex];
            
            // Check if we're in away mode and auto turn off is enabled
            if (!userIsHome && autoTurnOffEnabled) {
                if (autoTurnOffOption === 'all') {
                    alert('Cannot toggle sockets in Away Mode with "Turn Off All Sockets" enabled');
                    return;
                } else if (autoTurnOffOption === 'priority' && socket.priority !== 'priority') {
                    alert('Cannot toggle non-priority sockets in Away Mode');
                    return;
                }
            }
            
            // Toggle active state
            const newState = !socket.active;
            socket.active = newState;
            
            // Send command to ESP32 via Bluetooth
            sendSocketCommand(socketId, newState);
            
            // Update both home and maintenance pages
            renderSockets();
            renderMaintenanceSockets();
            updateStats();
        }

        // Update statistics
        function updateStats() {
            const totalPower = sockets.reduce((sum, socket) => sum + socket.power, 0);
            const activeSockets = sockets.filter(socket => socket.active).length;

            document.getElementById('totalPower').textContent = totalPower.toFixed(1) + 'W';
            document.getElementById('activeSockets').textContent = activeSockets + ' / 3';
        }

        // Save settings and sync with home page
        function saveSettings() {
            // Update socket names and priorities from settings
            sockets.forEach(socket => {
                const nameInput = document.querySelector(`.socket-name-input[data-socket="${socket.id}"]`);
                const prioritySelect = document.querySelector(`.priority-select[data-socket="${socket.id}"]`);
                const limitInput = document.querySelector(`.socket-limit-input[data-socket="${socket.id}"]`);
                
                if (nameInput) {
                    socket.name = nameInput.value;
                }
                if (prioritySelect) {
                    socket.priority = prioritySelect.value;
                }
                if (limitInput) {
                    socket.limit = parseFloat(limitInput.value) || socket.limit;
                }
            });
            
            // Save auto turn off settings
            const autoTurnOffSettings = {
                enabled: autoTurnOffEnabled,
                option: autoTurnOffOption
            };
            localStorage.setItem('autoTurnOffSettings', JSON.stringify(autoTurnOffSettings));
            
            // Send settings to ESP32
            sendAutoTurnOffSettings();
            sendSocketSettings();
            
            // Update the home page with new settings
            renderSockets();
            
            // Show success message
            alert('Settings saved successfully! Socket names and priorities updated.');
        }

        // Page navigation
        function showPage(pageId) {
            // Hide all pages
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            
            // Show selected page
            document.getElementById(pageId).classList.add('active');
            
            // Update nav items
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Initialize chart if on consumption page
            if (pageId === 'consumption-page') {
                updateConsumptionChart();
            }
        }

        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', initApp);
    
    
    