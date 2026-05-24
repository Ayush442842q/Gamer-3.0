import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [tunnelUrl, setTunnelUrl] = useState(() => {
    return localStorage.getItem('candy_crush_bot_url') || 'ws://localhost:8000/ws';
  });
  const [isConnected, setIsConnected] = useState(false);
  const [botRunning, setBotRunning] = useState(false);
  const [gameState, setGameState] = useState('DISCONNECTED');
  const [frame, setFrame] = useState(null);
  const [grid, setGrid] = useState([]);
  const [suggestedMove, setSuggestedMove] = useState(null);
  const [logs, setLogs] = useState([]);
  const [deviceInfo, setDeviceInfo] = useState({ id: 'None', resolution: 'Unknown' });
  const [stats, setStats] = useState({ movesCount: 0, startTime: null, elapsed: '00:00' });
  
  // Calibration Coordinates
  const [calib, setCalib] = useState({
    board_x: 42,
    board_y: 820,
    board_w: 996,
    board_h: 996
  });
  const [speedMode, setSpeedMode] = useState('fast');
  const [activeGame, setActiveGame] = useState('candy_crush');
  const [view, setView] = useState('hub');

  const socketRef = useRef(null);

  const launchGame = (gameId) => {
    setActiveGame(gameId);
    setView('dashboard');
    // If connected, sync the active game immediately to the backend
    if (isConnected && socketRef.current) {
      socketRef.current.send(JSON.stringify({ command: 'select_game', game: gameId }));
    }
  };

  const backToHub = () => {
    setView('hub');
    setGrid([]);
    setSuggestedMove(null);
  };
  const consoleEndRef = useRef(null);
  const canvasRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Elapsed timer when bot is running
  useEffect(() => {
    let timer = null;
    if (botRunning && stats.startTime) {
      timer = setInterval(() => {
        const diffMs = new Date() - stats.startTime;
        const diffSecs = Math.floor(diffMs / 1000);
        const mins = Math.floor(diffSecs / 60).toString().padStart(2, '0');
        const secs = (diffSecs % 60).toString().padStart(2, '0');
        setStats(prev => ({ ...prev, elapsed: `${mins}:${secs}` }));
      }, 1000);
    } else if (!botRunning) {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [botRunning, stats.startTime]);

  // Dynamic browser tab title
  useEffect(() => {
    if (view === 'hub') {
      document.title = 'GAAMEER | Game Hub';
    } else {
      document.title = activeGame === 'candy_crush' 
        ? 'GAAMEER | Candy Crush Saga Bot' 
        : 'GAAMEER | Subway Surfers Bot';
    }
  }, [activeGame, view]);

  const connectWebSocket = () => {
    if (isConnected) {
      disconnectWebSocket();
      return;
    }

    // Clean URL
    let wsUrl = tunnelUrl.trim();
    if (wsUrl.startsWith('http://')) wsUrl = wsUrl.replace('http://', 'ws://');
    if (wsUrl.startsWith('https://')) wsUrl = wsUrl.replace('https://', 'wss://');
    if (!wsUrl.includes('/ws') && !wsUrl.endsWith('/ws')) {
      wsUrl = wsUrl.endsWith('/') ? `${wsUrl}ws` : `${wsUrl}/ws`;
    }

    console.log(`Connecting to WebSocket: ${wsUrl}`);
    addLog(`[System] Connecting to local backend at ${wsUrl}...`);
    
    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        localStorage.setItem('candy_crush_bot_url', tunnelUrl);
        setGameState('CONNECTED');
        addLog('[System] WebSocket connection established successfully.');
      };

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        
        if (payload.type === 'init') {
          setDeviceInfo({
            id: payload.device_id || 'ZD2227H2FK',
            resolution: payload.resolution || '1080x2400'
          });
          if (payload.config) {
            setCalib({
              board_x: payload.config.board_x,
              board_y: payload.config.board_y,
              board_w: payload.config.board_w,
              board_h: payload.config.board_h
            });
            if (payload.config.speed_mode) {
              setSpeedMode(payload.config.speed_mode);
            }
            if (payload.config.active_game) {
              setActiveGame(payload.config.active_game);
            }
          }
          addLog(`[System] Device ready: ${payload.device_id} (${payload.resolution})`);
        } 
        
        else if (payload.type === 'update') {
          if (payload.frame) {
            setFrame(payload.frame);
            drawFrameOnCanvas(payload.frame);
          }
          if (payload.grid) setGrid(payload.grid);
          if (payload.state) setGameState(payload.state);
          setBotRunning(payload.bot_running);
          setSuggestedMove(payload.suggested_move);
        }
        
        else if (payload.type === 'status') {
          if (payload.state) setGameState(payload.state);
          setBotRunning(payload.bot_running);
          if (payload.grid) setGrid(payload.grid);
          if (payload.suggested_move) {
            setSuggestedMove(payload.suggested_move);
            setStats(prev => ({ ...prev, movesCount: prev.movesCount + 1 }));
          }
        }
        
        else if (payload.type === 'log') {
          addLog(payload.data);
        }
      };

      socket.onclose = (event) => {
        setIsConnected(false);
        setBotRunning(false);
        setGameState('DISCONNECTED');
        addLog(`[System] Connection closed. Code: ${event.code}.`);
      };

      socket.onerror = (error) => {
        addLog('[System Error] WebSocket encountered an error.');
        console.error(error);
      };

    } catch (e) {
      addLog(`[System Error] Failed to connect: ${e.message}`);
      setIsConnected(false);
    }
  };

  const disconnectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
  };

  const handleGameChange = (newGame) => {
    setActiveGame(newGame);
    const gameName = newGame === 'candy_crush' ? 'Candy Crush Saga' : 'Subway Surfers';
    addLog(`[Client] Theme and mode set to ${gameName}.`);
    if (isConnected) {
      sendCommand('select_game', { game: newGame });
    }
  };

  const addLog = (message) => {
    setLogs(prev => [...prev.slice(-99), message]); // Keep last 100 logs
  };

  const sendCommand = (cmd, extra = {}) => {
    if (socketRef.current && isConnected) {
      socketRef.current.send(JSON.stringify({ command: cmd, ...extra }));
    } else {
      addLog('[System] Warning: Command ignored, socket disconnected.');
    }
  };

  const toggleBot = () => {
    if (botRunning) {
      sendCommand('pause');
      setBotRunning(false);
    } else {
      setStats(prev => ({ ...prev, startTime: new Date(), elapsed: '00:00' }));
      sendCommand('start');
      setBotRunning(true);
    }
  };

  const drawFrameOnCanvas = (dataUrl) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Draw Board Calibration Overlay Box on canvas
      // Need to scale board coords since stream image is resized (to 40%)
      const scaleX = canvas.width / 1080;
      const scaleY = canvas.height / 2400; // aspect ratio height config
      
      ctx.strokeStyle = activeGame === 'candy_crush' ? '#d946ef' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        calib.board_x * scaleX,
        calib.board_y * scaleY,
        calib.board_w * scaleX,
        calib.board_h * scaleY
      );
      
      // Draw grid lines inside the boundary
      ctx.strokeStyle = activeGame === 'candy_crush' ? 'rgba(217, 70, 239, 0.2)' : 'rgba(245, 158, 11, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      
      const stepX = (calib.board_w * scaleX) / 8;
      const stepY = (calib.board_h * scaleY) / 8;
      
      for (let i = 1; i < 8; i++) {
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(calib.board_x * scaleX + i * stepX, calib.board_y * scaleY);
        ctx.lineTo(calib.board_x * scaleX + i * stepX, (calib.board_y + calib.board_h) * scaleY);
        ctx.stroke();
        
        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(calib.board_x * scaleX, calib.board_y * scaleY + i * stepY);
        ctx.lineTo((calib.board_x + calib.board_w) * scaleX, calib.board_y * scaleY + i * stepY);
        ctx.stroke();
      }
    };
    img.src = dataUrl;
  };

  // Click on stream canvas -> send physical touch tap to phone
  const handleCanvasClick = (e) => {
    if (!isConnected) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Scale coordinate back to original phone resolution (1080x2400)
    const phoneX = Math.round((clickX / rect.width) * 1080);
    const phoneY = Math.round((clickY / rect.height) * 2400);
    
    addLog(`[Client] Sending tap gesture to coordinates: (${phoneX}, ${phoneY})`);
    sendCommand('tap', { x: phoneX, y: phoneY });
  };

  const handleCalibChange = (e) => {
    const { name, value } = e.target;
    setCalib(prev => ({
      ...prev,
      [name]: parseInt(value) || 0
    }));
  };

  const saveCalibration = async () => {
    const localUrl = tunnelUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
    addLog('[Client] Saving board calibration coordinates to backend...');
    
    try {
      const response = await fetch(`${localUrl}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board_x: calib.board_x,
          board_y: calib.board_y,
          board_w: calib.board_w,
          board_h: calib.board_h,
          threshold: 0.70,
          animation_settle: 800,
          speed_mode: speedMode,
          active_game: activeGame
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        addLog('[System] Calibration saved successfully.');
      } else {
        addLog(`[System] Calibration save failed: ${data.message}`);
      }
    } catch (e) {
      addLog(`[System Error] Failed to update backend config: ${e.message}`);
    }
  };

  const handleSpeedChange = async (newSpeed) => {
    setSpeedMode(newSpeed);
    addLog(`[Client] Changing speed mode to ${newSpeed}...`);
    
    const localUrl = tunnelUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '');
    try {
      const response = await fetch(`${localUrl}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board_x: calib.board_x,
          board_y: calib.board_y,
          board_w: calib.board_w,
          board_h: calib.board_h,
          threshold: 0.70,
          animation_settle: 800,
          speed_mode: newSpeed,
          active_game: activeGame
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        addLog(`[System] Speed mode changed to ${newSpeed} successfully.`);
      } else {
        addLog(`[System] Speed mode change failed: ${data.message}`);
      }
    } catch (e) {
      addLog(`[System Error] Failed to change speed mode: ${e.message}`);
    }
  };

  // Helper to check if grid cell is in active swap
  const isCellInSwap = (r, c) => {
    if (!suggestedMove) return false;
    const { r1, c1, r2, c2 } = suggestedMove;
    return (r === r1 && c === c1) || (r === r2 && c === c2);
  };

  const renderCandyIcon = (candyId) => {
    // Return a text symbol or abbreviation representing special candies
    if (candyId === 0) return '';
    if (candyId >= 1 && candyId <= 6) return '🍬';
    if (candyId === 7) return '↔️'; // Horizontal Stripe
    if (candyId === 8) return '↕️'; // Vertical Stripe
    if (candyId === 9) return '💣'; // Wrapped bomb
    if (candyId === 10) return '⭐'; // Color Bomb
    return '?';
  };

  const candyNames = {
    0: "Empty", 1: "Red", 2: "Orange", 3: "Yellow", 4: "Green", 5: "Blue",
    6: "Purple", 7: "Striped H", 8: "Striped V", 9: "Wrapped", 10: "Color Bomb"
  };

  if (view === 'hub') {
    return (
      <div className="app-container theme-hub">
        <div className="hub-container">
          <header className="hub-header">
            <h1>GAAMEER</h1>
            <p className="hub-subtitle">
              Sleek AI & Vision Game Automation Hub. Pick an active automation module below to connect and control your connected Android device.
            </p>
          </header>

          <div className="hub-cards-grid">
            {/* Candy Crush Card */}
            <div className="hub-card candy-crush-card animate-slide-in" style={{ animationDelay: '0.1s' }}>
              <div className="hub-card-icon">🍬</div>
              <h2 className="hub-card-title">Candy Crush Saga</h2>
              <p className="hub-card-desc">
                High-fidelity 8x8 grid state classifier, match detector, and reinforcement action solver. Automates match-3 gameplay utilizing precise ADB swipe gestures.
              </p>
              <div className="hub-card-tags">
                <span className="hub-card-tag">Vision Classification</span>
                <span className="hub-card-tag">8x8 Solver</span>
                <span className="hub-card-tag">State Machine</span>
              </div>
              <button className="btn-hub-launch" onClick={() => launchGame('candy_crush')}>
                LAUNCH BOT
              </button>
            </div>

            {/* Subway Surfers Card */}
            <div className="hub-card subway-surfers-card animate-slide-in" style={{ animationDelay: '0.2s' }}>
              <div className="hub-card-icon">🏃‍♂️</div>
              <h2 className="hub-card-title">Subway Surfers</h2>
              <p className="hub-card-desc">
                High-speed Canny edge density vision lane occupancy scanner and instant non-blocking swipe dodge system. Runs under low-latency ADB execution pipes.
              </p>
              <div className="hub-card-tags">
                <span className="hub-card-tag">Lane Density Edge</span>
                <span className="hub-card-tag">Dodge Logic</span>
                <span className="hub-card-tag">Asynchronous ADB</span>
              </div>
              <button className="btn-hub-launch" onClick={() => launchGame('subway_surfers')}>
                LAUNCH BOT
              </button>
            </div>

            {/* Coming Soon Card */}
            <div className="hub-card disabled-card animate-slide-in" style={{ animationDelay: '0.3s' }}>
              <div className="hub-card-icon">🎮</div>
              <h2 className="hub-card-title">More Modules</h2>
              <p className="hub-card-desc">
                New game modules (e.g. Temple Run, Flappy Bird, and clickers) are currently under development. AI modules and CV models will be added soon.
              </p>
              <div className="hub-card-tags">
                <span className="hub-card-tag">Future Module</span>
                <span className="hub-card-tag">CV Classifier</span>
              </div>
              <button className="btn-hub-launch" disabled style={{ opacity: 0.5 }}>
                COMING SOON
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container theme-${activeGame === 'candy_crush' ? 'candy-crush' : 'subway-surfers'}`}>
      {/* Header Bar */}
      <header className="app-header">
        <div className="brand">
          <button className="btn-back-hub" onClick={backToHub} style={{ marginRight: '0.5rem' }}>
            ← Back
          </button>
          <h1>GAAMEER</h1>
          <span className="brand-badge">
            {activeGame === 'candy_crush' ? 'CANDY BOT v3.0' : 'RUNNER BOT v3.0'}
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="connection-box">
            <input 
              type="text" 
              className="input-tunnel" 
              placeholder="ws://localhost:8000/ws or wss://tunnel.ngrok..."
              value={tunnelUrl}
              onChange={(e) => setTunnelUrl(e.target.value)}
              disabled={isConnected}
            />
            <button 
              className={`btn-connect ${isConnected ? 'connected' : ''}`}
              onClick={connectWebSocket}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid View */}
      <main className="dashboard-grid">
        {/* Left Side Panel (Controls, Logs, Calibration) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* FSM Control Card */}
          <div className="dashboard-card animate-slide-in">
            <div className="card-title">
              <span>Control Deck</span>
              <span className={`brand-badge ${botRunning ? 'glow-text-green' : ''}`} style={{
                backgroundColor: botRunning ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                borderColor: botRunning ? 'var(--accent-green)' : 'var(--accent-red)',
                color: botRunning ? 'var(--accent-green)' : 'var(--accent-red)'
              }}>
                {botRunning ? 'ACTIVE' : 'PAUSED'}
              </span>
            </div>
            
            <div className="control-grid" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                className={`btn-ctrl ${botRunning ? 'pause' : 'start'}`}
                onClick={toggleBot}
                disabled={!isConnected}
                style={{ width: '100%', marginBottom: '0.25rem' }}
              >
                {botRunning ? 'PAUSE BOT' : 'START AUTO-PLAY'}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
                <span className="stat-label" style={{ fontSize: '0.85rem' }}>Speed Mode:</span>
                <select 
                  value={speedMode} 
                  onChange={(e) => handleSpeedChange(e.target.value)}
                  disabled={!isConnected}
                  style={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    color: '#f3f4f6',
                    padding: '0.35rem 0.6rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    outline: 'none',
                    flexGrow: 1,
                    textAlign: 'right'
                  }}
                >
                  <option value="normal">Normal (0.5-0.9s delay)</option>
                  <option value="fast">Fast (0.15-0.3s delay)</option>
                  <option value="insane">Insane (0.05-0.12s delay)</option>
                </select>
              </div>
            </div>

            <div className="stats-container">
              <div className="stat-item">
                <span className="stat-label">Bot State</span>
                <span className="stat-val" style={{
                  color: gameState === 'PLAYING' ? 'var(--accent-blue)' : 
                         gameState === 'DISCONNECTED' ? 'var(--accent-red)' : 'var(--accent-yellow)'
                }}>{gameState}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Running Time</span>
                <span className="stat-val">{stats.elapsed}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">
                  {activeGame === 'subway_surfers' ? 'Actions Logged' : 'Swaps Executed'}
                </span>
                <span className="stat-val">{stats.movesCount}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Connected Device</span>
                <span className="stat-val" style={{ fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {deviceInfo.id}
                </span>
              </div>
            </div>
          </div>

          {/* Grid Calibration Card */}
          <div className="dashboard-card animate-slide-in" style={{ animationDelay: '0.1s' }}>
            <div className="card-title">
              <span>Grid Calibration</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-connect" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', backgroundColor: 'var(--accent-theme)', borderColor: 'var(--accent-theme)' }} onClick={() => sendCommand('calibrate')} disabled={!isConnected}>
                  Auto Detect
                </button>
                <button className="btn-connect" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} onClick={saveCalibration} disabled={!isConnected}>
                  Apply
                </button>
              </div>
            </div>
            
            <div className="calibration-inputs">
              <div className="calib-field">
                <label>X-Offset</label>
                <input type="number" name="board_x" value={calib.board_x} onChange={handleCalibChange} />
              </div>
              <div className="calib-field">
                <label>Y-Offset</label>
                <input type="number" name="board_y" value={calib.board_y} onChange={handleCalibChange} />
              </div>
              <div className="calib-field">
                <label>Width</label>
                <input type="number" name="board_w" value={calib.board_w} onChange={handleCalibChange} />
              </div>
              <div className="calib-field">
                <label>Height</label>
                <input type="number" name="board_h" value={calib.board_h} onChange={handleCalibChange} />
              </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Draws a dotted calibration boundary over the phone live stream. Drag sliders or change values, then click Apply.
            </p>
          </div>

          {/* Retro Log Console Card */}
          <div className="dashboard-card console-card animate-slide-in" style={{ animationDelay: '0.2s' }}>
            <div className="card-title">
              <span>Live Console Log</span>
              <button 
                onClick={() => setLogs([])}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Clear
              </button>
            </div>
            <div className="console-body">
              {logs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Console idle. Awaiting connection...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="console-line">{log}</div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </div>

        {/* Right Side Panel (Live stream and solver board) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          
          {/* Phone Frame Stream */}
          <div className="dashboard-card animate-slide-in" style={{ animationDelay: '0.1s' }}>
            <div className="card-title">
              <span>Phone Screen Mirror</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click screen to trigger remote tap</span>
            </div>
            
            <div className="livestream-container">
              {frame ? (
                <canvas 
                  ref={canvasRef} 
                  className="livestream-canvas"
                  width={360} 
                  height={800}
                  onClick={handleCanvasClick}
                />
              ) : (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: 'var(--text-muted)',
                  gap: '1rem',
                  padding: '2rem',
                  textAlign: 'center',
                  border: '2px dashed var(--border-color)',
                  borderRadius: '12px'
                }}>
                  <div className="animate-pulse-slow" style={{ fontSize: '3rem' }}>📱</div>
                  <div>Awaiting frame stream...<br/>Please connect to the local server tunnel.</div>
                </div>
              )}
            </div>
          </div>

          {/* Stylized Solver 8x8 Grid */}
          <div className="dashboard-card animate-slide-in" style={{ animationDelay: '0.2s' }}>
            <div className="card-title">
              <span>Solver Board Mirror</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Highlights target swap</span>
            </div>
            
            <div className="board-grid-wrapper">
              {activeGame === 'subway_surfers' ? (
                grid && grid.length > 0 ? (
                  <div className="subway-road">
                    {[0, 1, 2].map((laneIdx) => {
                      const isOccupied = grid && grid[2] && grid[2][laneIdx] === 1;
                      const hasPlayer = grid && grid[3] && grid[3][laneIdx] === 2;
                      const density = grid && grid[0] ? grid[0][laneIdx] : 0;
                      
                      return (
                        <div key={laneIdx} className={`subway-lane ${hasPlayer ? 'player-lane' : ''}`}>
                          <div className="lane-header">
                            {laneIdx === 0 ? 'Left' : laneIdx === 1 ? 'Center' : 'Right'}
                          </div>
                          <div className="lane-body">
                            {isOccupied && (
                              <div className="obstacle-box animate-pulse-slow">
                                <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                                <span style={{ fontWeight: 'bold' }}>OBSTACLE</span>
                                <span className="density-tag">Density: {density}%</span>
                              </div>
                            )}
                            {hasPlayer && (
                              <div className="player-icon">
                                🏃‍♂️ RUNNER
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{
                    height: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: 'var(--text-muted)',
                    gap: '1rem',
                    textAlign: 'center',
                    width: '100%',
                    border: '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-tertiary)'
                  }}>
                    <div className="animate-pulse-slow" style={{ fontSize: '3rem' }}>🏃‍♂️</div>
                    <div>Awaiting lane/track stream...<br/>Ensure bot is running and you are in a live run.</div>
                  </div>
                )
              ) : (
                grid && grid.length > 0 ? (
                  <div className="candy-grid">
                    {grid.map((row, rIdx) => 
                      row.map((candyId, cIdx) => (
                        <div 
                          key={`${rIdx}-${cIdx}`}
                          className={`candy-cell candy-${candyId} ${isCellInSwap(rIdx, cIdx) ? 'active-swap' : ''}`}
                          title={`Pos: (${rIdx}, ${cIdx}) | Type: ${candyNames[candyId] || 'Unknown'}`}
                        >
                          {renderCandyIcon(candyId)}
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div style={{
                    height: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: 'var(--text-muted)',
                    gap: '1rem',
                    textAlign: 'center',
                    width: '100%',
                    border: '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-tertiary)'
                  }}>
                    <div className="animate-pulse-slow" style={{ fontSize: '3rem' }}>🍬</div>
                    <div>Awaiting grid data...<br/>Ensure bot is running and game is on a live level.</div>
                  </div>
                )
              )}
            </div>
            
            {suggestedMove && (
              <div style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                padding: '0.75rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.875rem'
              }}>
                <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>⭐ Next Action:</span>
                {activeGame === 'subway_surfers' ? (
                  <span>Swipe {suggestedMove.direction.toUpperCase()} to dodge obstacle</span>
                ) : (
                  <span>Swap ({suggestedMove.r1}, {suggestedMove.c1}) with ({suggestedMove.r2}, {suggestedMove.c2})</span>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
