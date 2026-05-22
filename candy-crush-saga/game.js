/**
 * Candy Crush Saga - Core Game Engine
 * Implements board state, matching algorithm, drag-and-drop, animations, and levels.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- Game State Constants ---
  const BOARD_ROWS = 8;
  const BOARD_COLS = 8;
  const CANDY_COLORS_COUNT = 6;
  
  // Game state variables
  let board = []; // 2D array: board[row][col] = { color: 0-5, type: 'normal'|'striped-h'|'striped-v'|'wrapped'|'bomb', id: UniqueNumber }
  let score = 0;
  let movesLeft = 30;
  let currentLevel = 1;
  let targetScore = 1500;
  let highScore = 0;
  let uniqueIdCounter = 0;
  let isBoardLocked = false;
  let comboCount = 0;

  // Selected tile for swapping
  let selectedTile = null; // { row, col, element }

  // Boosters inventory
  let boosters = {
    hammer: 1,
    color: 1,
    shuffle: 1
  };
  let activeBooster = null; // 'hammer' | 'color' | 'shuffle' | null

  // --- Theme Configurations ---
  const themeSelect = document.getElementById('theme-select');
  const soundToggleBtn = document.getElementById('sound-toggle');
  const soundStatusIcon = document.getElementById('sound-status-icon');

  // Load saved preferences
  let currentTheme = localStorage.getItem('candy-theme') || 'classic';
  let soundOn = localStorage.getItem('candy-sound') !== 'false';

  themeSelect.value = currentTheme;
  document.body.className = `theme-${currentTheme}`;
  
  if (soundOn) {
    soundToggleBtn.classList.add('active');
    soundStatusIcon.textContent = '🔊';
  } else {
    soundToggleBtn.classList.remove('active');
    soundStatusIcon.textContent = '🔇';
    GameAudio.enable(false);
  }

  // --- SVGs Definitions for Candies ---
  // Beautiful dynamic inline SVGs for high resolution candy icons
  function getCandySVG(color, type) {
    const gradients = [
      // 0: Red
      `<linearGradient id="grad-red-${color}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ff6b8b"/>
        <stop offset="60%" stop-color="#e0115f"/>
        <stop offset="100%" stop-color="#800020"/>
      </linearGradient>`,
      // 1: Blue
      `<linearGradient id="grad-blue-${color}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#7fe7ff"/>
        <stop offset="60%" stop-color="#0099ff"/>
        <stop offset="100%" stop-color="#0033aa"/>
      </linearGradient>`,
      // 2: Yellow
      `<linearGradient id="grad-yellow-${color}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffff9d"/>
        <stop offset="60%" stop-color="#ffcc00"/>
        <stop offset="100%" stop-color="#b38600"/>
      </linearGradient>`,
      // 3: Green
      `<linearGradient id="grad-green-${color}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#a6ffb2"/>
        <stop offset="60%" stop-color="#2ecc71"/>
        <stop offset="100%" stop-color="#1b7a43"/>
      </linearGradient>`,
      // 4: Purple
      `<linearGradient id="grad-purple-${color}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e8a6ff"/>
        <stop offset="60%" stop-color="#9b59b6"/>
        <stop offset="100%" stop-color="#4a1564"/>
      </linearGradient>`,
      // 5: Orange
      `<linearGradient id="grad-orange-${color}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffc68c"/>
        <stop offset="60%" stop-color="#e67e22"/>
        <stop offset="100%" stop-color="#963e00"/>
      </linearGradient>`
    ];

    // SVG templates for different candy shapes
    const shapes = [
      // 0: Heart (Red)
      `<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="url(#grad-red-${color})"/>`,
      // 1: Diamond (Blue)
      `<path d="M12 2L2 12l10 10 10-10L12 2z" fill="url(#grad-blue-${color})"/>`,
      // 2: Star (Yellow)
      `<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="url(#grad-yellow-${color})"/>`,
      // 3: Clover/Donut (Green)
      `<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 15a5 5 0 1 1 5-5 5 5 0 0 1-5 5z" fill="url(#grad-green-${color})"/>`,
      // 4: Hexagon (Purple)
      `<path d="M12 2L4 6.5v11L12 22l8-4.5v-11L12 2z" fill="url(#grad-purple-${color})"/>`,
      // 5: Drop/Triangle (Orange)
      `<path d="M12 3L2 20h20L12 3z" fill="url(#grad-orange-${color})"/>`
    ];

    if (type === 'bomb') {
      // Color Bomb: dark chocolate ball with colorful sprinkles
      return `<svg class="candy-svg" viewBox="0 0 24 24">
        <defs>
          <radialGradient id="grad-bomb" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#555"/>
            <stop offset="50%" stop-color="#1a1a1a"/>
            <stop offset="100%" stop-color="#050505"/>
          </radialGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="url(#grad-bomb)" stroke="#fff" stroke-width="0.5"/>
        <!-- Sprinkles -->
        <circle cx="8" cy="8" r="1.5" fill="#ff3366"/>
        <circle cx="15" cy="7" r="1.5" fill="#33ccff"/>
        <circle cx="16" cy="15" r="1.5" fill="#ffcc00"/>
        <circle cx="8" cy="15" r="1.5" fill="#33cc66"/>
        <circle cx="12" cy="11" r="1.5" fill="#ff9933"/>
        <circle cx="12" cy="18" r="1.5" fill="#9933ff"/>
      </svg>`;
    }

    let innerContent = shapes[color] || shapes[0];

    // If striped, add stripe overlays
    if (type === 'striped-h') {
      innerContent += `
        <!-- Horizontal Stripes -->
        <line x1="2" y1="12" x2="22" y2="12" stroke="#fff" stroke-dasharray="3,3" stroke-width="2.5" />
        <line x1="2" y1="8" x2="22" y2="8" stroke="#fff" stroke-dasharray="2,4" stroke-width="1.5" />
        <line x1="2" y1="16" x2="22" y2="16" stroke="#fff" stroke-dasharray="2,4" stroke-width="1.5" />
      `;
    } else if (type === 'striped-v') {
      innerContent += `
        <!-- Vertical Stripes -->
        <line x1="12" y1="2" x2="12" y2="22" stroke="#fff" stroke-dasharray="3,3" stroke-width="2.5" />
        <line x1="8" y1="2" x2="8" y2="22" stroke="#fff" stroke-dasharray="2,4" stroke-width="1.5" />
        <line x1="16" y1="2" x2="16" y2="22" stroke="#fff" stroke-dasharray="2,4" stroke-width="1.5" />
      `;
    }

    return `<svg class="candy-svg" viewBox="0 0 24 24">
      <defs>${gradients[color]}</defs>
      ${innerContent}
    </svg>`;
  }

  // --- Board Initialization ---
  const gameBoardEl = document.getElementById('game-board');

  function initBoard() {
    board = [];
    gameBoardEl.innerHTML = '';
    
    for (let r = 0; r < BOARD_ROWS; r++) {
      board[r] = [];
      for (let c = 0; c < BOARD_COLS; c++) {
        // Generate random candies ensuring no starting match-3s
        let color;
        do {
          color = Math.floor(Math.random() * CANDY_COLORS_COUNT);
        } while (
          (r >= 2 && board[r-1][c].color === color && board[r-2][c].color === color) ||
          (c >= 2 && board[r][c-1].color === color && board[r][c-2].color === color)
        );

        board[r][c] = {
          color: color,
          type: 'normal',
          id: uniqueIdCounter++
        };
      }
    }
    
    // Check if the board has valid moves, if not shuffle
    if (!hasValidMoves()) {
      shuffleBoard();
    } else {
      renderBoard();
    }
  }

  function renderBoard() {
    gameBoardEl.innerHTML = '';
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const candy = board[r][c];
        if (!candy) continue;

        const tile = document.createElement('div');
        tile.classList.add('candy-tile');
        tile.dataset.row = r;
        tile.dataset.col = c;
        tile.dataset.id = candy.id;
        
        // Add styling for special candies
        if (candy.type === 'striped-h') tile.classList.add('special-striped-h');
        if (candy.type === 'striped-v') tile.classList.add('special-striped-v');
        if (candy.type === 'wrapped') tile.classList.add('special-wrapped');
        if (candy.type === 'bomb') tile.classList.add('special-bomb');

        tile.innerHTML = getCandySVG(candy.color, candy.type);

        // Bind interactive event handlers
        tile.addEventListener('mousedown', onTileMouseDown);
        tile.addEventListener('touchstart', onTileTouchStart, { passive: true });

        gameBoardEl.appendChild(tile);
      }
    }
  }

  // --- Interaction Logic ---
  let startX = 0;
  let startY = 0;
  let isDragging = false;

  function onTileMouseDown(e) {
    if (isBoardLocked) return;
    GameAudio.init(); // Play policy initialization
    
    const tileEl = e.currentTarget;
    const r = parseInt(tileEl.dataset.row);
    const c = parseInt(tileEl.dataset.col);

    if (activeBooster) {
      handleBoosterAction(r, c);
      return;
    }

    selectTile(r, c, tileEl);
    
    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;

    // Track mouse dragging
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    if (!isDragging || !selectedTile) return;

    const diffX = e.clientX - startX;
    const diffY = e.clientY - startY;
    const threshold = 30; // Min pixels dragged to trigger a swap

    if (Math.abs(diffX) > threshold || Math.abs(diffY) > threshold) {
      let targetRow = selectedTile.row;
      let targetCol = selectedTile.col;

      if (Math.abs(diffX) > Math.abs(diffY)) {
        // Horizontal drag
        targetCol += diffX > 0 ? 1 : -1;
      } else {
        // Vertical drag
        targetRow += diffY > 0 ? 1 : -1;
      }

      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (isValidCoord(targetRow, targetCol)) {
        attemptSwap(selectedTile.row, selectedTile.col, targetRow, targetCol);
      } else {
        deselectTile();
      }
    }
  }

  function onMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  // Touch handlers for mobile devices
  let touchStartTile = null;

  function onTileTouchStart(e) {
    if (isBoardLocked) return;
    GameAudio.init();

    const tileEl = e.currentTarget;
    const r = parseInt(tileEl.dataset.row);
    const c = parseInt(tileEl.dataset.col);

    if (activeBooster) {
      handleBoosterAction(r, c);
      return;
    }

    selectTile(r, c, tileEl);
    touchStartTile = selectedTile;

    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;

    tileEl.addEventListener('touchmove', onTouchMove, { passive: true });
    tileEl.addEventListener('touchend', onTouchEnd);
  }

  function onTouchMove(e) {
    if (!touchStartTile || !selectedTile) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - startX;
    const diffY = touch.clientY - startY;
    const threshold = 25;

    if (Math.abs(diffX) > threshold || Math.abs(diffY) > threshold) {
      let targetRow = selectedTile.row;
      let targetCol = selectedTile.col;

      if (Math.abs(diffX) > Math.abs(diffY)) {
        targetCol += diffX > 0 ? 1 : -1;
      } else {
        targetRow += diffY > 0 ? 1 : -1;
      }

      // Remove listeners
      e.currentTarget.removeEventListener('touchmove', onTouchMove);
      e.currentTarget.removeEventListener('touchend', onTouchEnd);
      touchStartTile = null;

      if (isValidCoord(targetRow, targetCol)) {
        attemptSwap(selectedTile.row, selectedTile.col, targetRow, targetCol);
      } else {
        deselectTile();
      }
    }
  }

  function onTouchEnd(e) {
    e.currentTarget.removeEventListener('touchmove', onTouchMove);
    e.currentTarget.removeEventListener('touchend', onTouchEnd);
    touchStartTile = null;
  }

  function selectTile(r, c, element) {
    // If clicking the already selected tile, deselect it
    if (selectedTile && selectedTile.row === r && selectedTile.col === c) {
      deselectTile();
      return;
    }

    if (selectedTile) {
      // Check if clicked tile is adjacent to previously selected
      const isAdjacent = Math.abs(selectedTile.row - r) + Math.abs(selectedTile.col - c) === 1;
      if (isAdjacent) {
        attemptSwap(selectedTile.row, selectedTile.col, r, c);
        return;
      } else {
        selectedTile.element.classList.remove('selected');
      }
    }

    selectedTile = { row: r, col: c, element: element };
    element.classList.add('selected');
  }

  function deselectTile() {
    if (selectedTile) {
      selectedTile.element.classList.remove('selected');
      selectedTile = null;
    }
  }

  function isValidCoord(r, c) {
    return r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS;
  }

  // --- Game Mechanics: Swapping and Matching ---
  
  async function attemptSwap(r1, c1, r2, c2) {
    isBoardLocked = true;
    deselectTile();

    const tile1 = getTileElement(r1, c1);
    const tile2 = getTileElement(r2, c2);

    // Play swap sound
    GameAudio.playSwap();

    // Visual animation swap
    await animateSwap(tile1, tile2);

    // Swap model data
    const temp = board[r1][c1];
    board[r1][c1] = board[r2][c2];
    board[r2][c2] = temp;

    // Reset visual position states by rendering
    renderBoard();

    // Check special candy swap triggers (e.g. Color Bomb combinations)
    let specialTriggered = false;
    if (board[r1][c1].type === 'bomb' || board[r2][c2].type === 'bomb') {
      await handleColorBombSwaps(r1, c1, r2, c2);
      specialTriggered = true;
    }

    let matches = [];
    if (!specialTriggered) {
      matches = checkAllMatches();
    }

    if (matches.length > 0 || specialTriggered) {
      // Valid move! Deduct move
      movesLeft--;
      comboCount = 0;
      updateStats();

      // Clear matching group and cascade board
      if (matches.length > 0) {
        await processMatches(matches, r2, c2); // Use landing coordinate r2, c2 to spawn special candies if applicable
      } else {
        await processCascades();
      }
    } else {
      // Invalid swap, swap them back!
      GameAudio.playError();
      await animateSwap(getTileElement(r1, c1), getTileElement(r2, c2));
      const temp2 = board[r1][c1];
      board[r1][c1] = board[r2][c2];
      board[r2][c2] = temp2;
      renderBoard();
      isBoardLocked = false;
    }
  }

  function animateSwap(t1, t2) {
    return new Promise((resolve) => {
      if (!t1 || !t2) {
        resolve();
        return;
      }
      const xDiff = t2.offsetLeft - t1.offsetLeft;
      const yDiff = t2.offsetTop - t1.offsetTop;

      t1.style.transition = 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)';
      t2.style.transition = 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)';

      t1.style.transform = `translate(${xDiff}px, ${yDiff}px)`;
      t2.style.transform = `translate(${-xDiff}px, ${-yDiff}px)`;

      setTimeout(() => {
        t1.style.transform = '';
        t2.style.transform = '';
        t1.style.transition = '';
        t2.style.transition = '';
        resolve();
      }, 260);
    });
  }

  function getTileElement(r, c) {
    return gameBoardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
  }

  // --- Special Swaps Trigger Logic ---
  async function handleColorBombSwaps(r1, c1, r2, c2) {
    const candy1 = board[r1][c1];
    const candy2 = board[r2][c2];

    if (candy1.type === 'bomb' && candy2.type === 'bomb') {
      // Double Color Bomb: clears the entire board!
      GameAudio.playExplosion();
      for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          triggerExplodeVisual(r, c);
          board[r][c] = null;
          score += 60;
        }
      }
      return;
    }

    if (candy1.type === 'bomb') {
      await activateColorBomb(r1, c1, candy2.color);
    } else if (candy2.type === 'bomb') {
      await activateColorBomb(r2, c2, candy1.color);
    }
  }

  async function activateColorBomb(bombR, bombC, targetColor) {
    GameAudio.playExplosion();
    triggerExplodeVisual(bombR, bombC);
    board[bombR][bombC] = null;
    score += 100;

    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (board[r][c] && board[r][c].color === targetColor) {
          triggerExplodeVisual(r, c);
          
          // If the cleared candy is striped/wrapped, trigger it
          if (board[r][c].type !== 'normal') {
            triggerSpecialCandy(r, c, board[r][c]);
          }
          board[r][c] = null;
          score += 50;
        }
      }
    }
    // Pause for explosion visuals
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  // --- Match Checker (Straight lines & intersections) ---
  function checkAllMatches() {
    let matchedCoords = new Set();
    let matchesGroups = [];

    // 1. Horizontal Scan
    for (let r = 0; r < BOARD_ROWS; r++) {
      let matchLen = 1;
      let startCol = 0;
      for (let c = 1; c <= BOARD_COLS; c++) {
        if (c < BOARD_COLS && board[r][c] && board[r][c-1] && board[r][c].color === board[r][c-1].color) {
          matchLen++;
        } else {
          if (matchLen >= 3) {
            let group = [];
            for (let i = startCol; i < startCol + matchLen; i++) {
              group.push({ row: r, col: i, color: board[r][i].color });
              matchedCoords.add(`${r},${i}`);
            }
            matchesGroups.push({ type: 'horizontal', coords: group });
          }
          matchLen = 1;
          startCol = c;
        }
      }
    }

    // 2. Vertical Scan
    for (let c = 0; c < BOARD_COLS; c++) {
      let matchLen = 1;
      let startRow = 0;
      for (let r = 1; r <= BOARD_ROWS; r++) {
        if (r < BOARD_ROWS && board[r][c] && board[r-1][c] && board[r][c].color === board[r-1][c].color) {
          matchLen++;
        } else {
          if (matchLen >= 3) {
            let group = [];
            for (let i = startRow; i < startRow + matchLen; i++) {
              group.push({ row: i, col: c, color: board[i][c].color });
              matchedCoords.add(`${i},${c}`);
            }
            matchesGroups.push({ type: 'vertical', coords: group });
          }
          matchLen = 1;
          startRow = r;
        }
      }
    }

    // Build unique connected component groups of matching tiles
    let groups = [];
    let visited = new Set();

    for (let key of matchedCoords) {
      if (visited.has(key)) continue;
      const [rStr, cStr] = key.split(',');
      const r = parseInt(rStr);
      const c = parseInt(cStr);
      const color = board[r][c].color;
      
      // BFS to find connected components of same color matching tiles
      let queue = [{ r, c }];
      let currentGroup = [];
      visited.add(key);

      while (queue.length > 0) {
        const curr = queue.shift();
        currentGroup.push(curr);

        // Check 4 directions
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (let [dr, dc] of dirs) {
          const nr = curr.r + dr;
          const nc = curr.c + dc;
          const nKey = `${nr},${nc}`;
          if (isValidCoord(nr, nc) && matchedCoords.has(nKey) && !visited.has(nKey) && board[nr][nc].color === color) {
            visited.add(nKey);
            queue.push({ r: nr, c: nc });
          }
        }
      }
      groups.push(currentGroup);
    }

    return groups;
  }

  // --- Processing Matches, Power-ups and Combos ---
  
  async function processMatches(matches, actionR = -1, actionC = -1) {
    comboCount++;
    GameAudio.playMatch(comboCount);

    // List of coordinates to spawn special candies after clearing matches
    let specialSpawns = [];

    // For each matching group, check if we need to create a special candy
    matches.forEach(group => {
      const size = group.length;
      if (size < 3) return;

      // Check coordinates in group
      let minR = BOARD_ROWS, maxR = -1;
      let minC = BOARD_COLS, maxC = -1;
      let rowsSet = new Set();
      let colsSet = new Set();

      group.forEach(coord => {
        minR = Math.min(minR, coord.r);
        maxR = Math.max(maxR, coord.r);
        minC = Math.min(minC, coord.c);
        maxC = Math.max(maxC, coord.c);
        rowsSet.add(coord.r);
        colsSet.add(coord.c);
      });

      const spanR = maxR - minR + 1;
      const spanC = maxC - minC + 1;

      // Find the best tile inside group to spawn special candy (prefers user-clicked action position, else the center of match)
      let spawnTile = group.find(coord => coord.r === actionR && coord.c === actionC);
      if (!spawnTile) {
        // Fallback to center of gravity of the group
        const centerIdx = Math.floor(size / 2);
        spawnTile = group[centerIdx];
      }

      const color = board[spawnTile.r][spawnTile.c].color;

      if (size >= 5 && (spanR === 5 || spanC === 5)) {
        // Match 5 in straight line: Color Bomb
        specialSpawns.push({ r: spawnTile.r, c: spawnTile.c, color: color, type: 'bomb' });
      } else if (rowsSet.size >= 3 && colsSet.size >= 3) {
        // L or T shape intersection: Wrapped Candy
        specialSpawns.push({ r: spawnTile.r, c: spawnTile.c, color: color, type: 'wrapped' });
      } else if (size === 4) {
        // Match 4: Striped Candy
        const type = spanC === 4 ? 'striped-v' : 'striped-h'; // Horizontal match makes vertical striped, vice versa
        specialSpawns.push({ r: spawnTile.r, c: spawnTile.c, color: color, type: type });
      }

      // Award base score: size * 60 points
      score += size * 60;
    });

    // Clear matching candies and trigger secondary special candy explosions
    let coordsToClear = [];
    matches.forEach(group => {
      group.forEach(coord => {
        coordsToClear.push(coord);
      });
    });

    // Trigger visual explosion on grid
    coordsToClear.forEach(coord => {
      triggerExplodeVisual(coord.r, coord.c);
    });

    // Handle nested special candy effects
    let extraClears = [];
    coordsToClear.forEach(coord => {
      const candy = board[coord.row || coord.r][coord.col || coord.c];
      if (candy && candy.type !== 'normal') {
        extraClears = extraClears.concat(triggerSpecialCandy(coord.row || coord.r, coord.col || coord.c, candy));
      }
    });

    // Apply secondary clears
    extraClears.forEach(coord => {
      if (isValidCoord(coord.r, coord.c) && board[coord.r][coord.c]) {
        triggerExplodeVisual(coord.r, coord.c);
        board[coord.r][coord.c] = null;
        score += 30;
      }
    });

    // Set matching candies to null
    coordsToClear.forEach(coord => {
      board[coord.row || coord.r][coord.col || coord.c] = null;
    });

    // Spawn special candies in empty slots
    specialSpawns.forEach(spawn => {
      board[spawn.r][spawn.c] = {
        color: spawn.color,
        type: spawn.type,
        id: uniqueIdCounter++
      };
    });

    // Wait for explosion animation to finish
    await new Promise(resolve => setTimeout(resolve, 320));

    // Collapse board and generate new candies
    await processCascades();
  }

  // Handle special candy explosions
  function triggerSpecialCandy(row, col, candy) {
    let clears = [];
    if (candy.type === 'striped-h') {
      // Clears whole row
      GameAudio.playExplosion();
      for (let c = 0; c < BOARD_COLS; c++) {
        if (c !== col) clears.push({ r: row, c: c });
      }
    } else if (candy.type === 'striped-v') {
      // Clears whole col
      GameAudio.playExplosion();
      for (let r = 0; r < BOARD_ROWS; r++) {
        if (r !== row) clears.push({ r: r, c: col });
      }
    } else if (candy.type === 'wrapped') {
      // Clears 3x3 square
      GameAudio.playExplosion();
      for (let r = row - 1; r <= row + 1; r++) {
        for (let c = col - 1; c <= col + 1; c++) {
          if (isValidCoord(r, c) && !(r === row && c === col)) {
            clears.push({ r: r, c: c });
          }
        }
      }
    }
    return clears;
  }

  function triggerExplodeVisual(r, c) {
    const tileEl = getTileElement(r, c);
    if (tileEl) {
      tileEl.classList.add('match-animation');
    }
  }

  // --- Cascading / Gravity fall ---
  async function processCascades() {
    let fell = false;

    // Shift candies down
    for (let c = 0; c < BOARD_COLS; c++) {
      // Scan column from bottom up
      for (let r = BOARD_ROWS - 1; r >= 0; r--) {
        if (board[r][c] === null) {
          // Find the nearest non-empty candy above it
          let aboveRow = r - 1;
          while (aboveRow >= 0 && board[aboveRow][c] === null) {
            aboveRow--;
          }

          if (aboveRow >= 0) {
            board[r][c] = board[aboveRow][c];
            board[aboveRow][c] = null;
            fell = true;
          }
        }
      }
    }

    // Spawn new candies in empty top slots
    for (let c = 0; c < BOARD_COLS; c++) {
      for (let r = BOARD_ROWS - 1; r >= 0; r--) {
        if (board[r][c] === null) {
          board[r][c] = {
            color: Math.floor(Math.random() * CANDY_COLORS_COUNT),
            type: 'normal',
            id: uniqueIdCounter++
          };
          fell = true;
        }
      }
    }

    if (fell) {
      // Re-render board and apply falling animations
      renderBoard();
      
      // Inject fall-animation classes to all tiles
      const tiles = gameBoardEl.querySelectorAll('.candy-tile');
      tiles.forEach(tile => {
        tile.classList.add('fall-animation');
      });

      // Wait for fall animation to complete
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Clear fall animation classes
      tiles.forEach(tile => {
        tile.classList.remove('fall-animation');
      });
    }

    // Check for cascade chain matches
    const chainMatches = checkAllMatches();
    if (chainMatches.length > 0) {
      // Loop recursion for matches
      await processMatches(chainMatches);
    } else {
      // Finished cascade sequence. Ensure user can move
      updateStats();
      
      // Game check status
      if (score >= targetScore) {
        levelUp();
      } else if (movesLeft <= 0) {
        gameOver();
      } else {
        // If board has locked with no moves left, auto shuffle
        if (!hasValidMoves()) {
          alert("No valid moves left! Shuffling board...");
          shuffleBoard();
        } else {
          isBoardLocked = false;
        }
      }
    }
  }

  // --- AI Match Checker: Check if moves exist ---
  function hasValidMoves() {
    // Temporarily swap adjacent candies and see if match check results in any matches
    const dirs = [[1, 0], [0, 1]]; // Down, Right

    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        if (!board[r][c]) continue;
        
        // Special candies like color bomb always allow moves
        if (board[r][c].type === 'bomb') return true;

        for (let [dr, dc] of dirs) {
          const nr = r + dr;
          const nc = c + dc;

          if (isValidCoord(nr, nc) && board[nr][nc]) {
            // Swap
            const temp = board[r][c];
            board[r][c] = board[nr][nc];
            board[nr][nc] = temp;

            // Check
            const matches = checkAllMatches();

            // Swap back
            const temp2 = board[r][c];
            board[r][c] = board[nr][nc];
            board[nr][nc] = temp2;

            if (matches.length > 0) return true;
          }
        }
      }
    }
    return false;
  }

  function shuffleBoard() {
    isBoardLocked = true;
    let attempts = 0;
    
    do {
      attempts++;
      // Shuffle elements in board using Fisher-Yates
      let flat = [];
      for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          if (board[r][c]) flat.push(board[r][c]);
        }
      }

      for (let i = flat.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = flat[i];
        flat[i] = flat[j];
        flat[j] = temp;
      }

      let idx = 0;
      for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          board[r][c] = flat[idx++];
        }
      }
      // Loop safety to prevent infinite loops (rare)
      if (attempts > 50) break;

    } while (checkAllMatches().length > 0 || !hasValidMoves());

    renderBoard();
    isBoardLocked = false;
  }

  // --- Power-ups / Boosters Implementation ---
  
  const hammerBtn = document.getElementById('booster-hammer');
  const colorBtn = document.getElementById('booster-color');
  const shuffleBtn = document.getElementById('booster-shuffle');

  hammerBtn.addEventListener('click', () => toggleBooster('hammer', hammerBtn));
  colorBtn.addEventListener('click', () => toggleBooster('color', colorBtn));
  shuffleBtn.addEventListener('click', () => {
    if (boosters.shuffle <= 0) return;
    boosters.shuffle--;
    document.getElementById('shuffle-count').textContent = boosters.shuffle;
    GameAudio.playSwap();
    shuffleBoard();
    updateStats();
  });

  function toggleBooster(boosterName, btnEl) {
    if (boosters[boosterName] <= 0) return;

    if (activeBooster === boosterName) {
      activeBooster = null;
      btnEl.classList.remove('active');
    } else {
      // Clear current booster state
      deselectTile();
      hammerBtn.classList.remove('active');
      colorBtn.classList.remove('active');
      
      activeBooster = boosterName;
      btnEl.classList.add('active');
    }
  }

  async function handleBoosterAction(r, c) {
    const booster = activeBooster;
    activeBooster = null;
    hammerBtn.classList.remove('active');
    colorBtn.classList.remove('active');

    if (booster === 'hammer') {
      boosters.hammer--;
      document.getElementById('hammer-count').textContent = boosters.hammer;
      
      isBoardLocked = true;
      GameAudio.playExplosion();
      triggerExplodeVisual(r, c);
      board[r][c] = null;
      
      score += 100;
      updateStats();
      
      await new Promise(resolve => setTimeout(resolve, 320));
      await processCascades();

    } else if (booster === 'color') {
      boosters.color--;
      document.getElementById('color-count').textContent = boosters.color;

      board[r][c] = {
        color: board[r][c] ? board[r][c].color : 0,
        type: 'bomb',
        id: uniqueIdCounter++
      };
      GameAudio.playSwap();
      renderBoard();
      
      // Auto-unlock
      isBoardLocked = false;
    }
  }

  // --- Statistics and UI update ---
  function updateStats() {
    document.getElementById('score-value').textContent = String(score).padStart(4, '0');
    document.getElementById('moves-value').textContent = movesLeft;
    document.getElementById('level-value').textContent = currentLevel;
    document.getElementById('target-value').textContent = targetScore;
    document.getElementById('highscore-value').textContent = String(highScore).padStart(4, '0');

    // Update Progress Bar
    const progressPercent = Math.min(100, Math.floor((score / targetScore) * 100));
    document.getElementById('score-progress').style.width = `${progressPercent}%`;
    document.getElementById('score-progress-bar').setAttribute('aria-valuenow', progressPercent);

    // Save state
    localStorage.setItem('candy-highscore', highScore);
  }

  // --- Level Up and Game Over Logic ---
  
  const lvlUpModal = document.getElementById('modal-level-up');
  const gameOverModal = document.getElementById('modal-game-over');

  function levelUp() {
    isBoardLocked = true;
    GameAudio.playLevelUp();

    // Fill details
    document.getElementById('lvlup-score').textContent = score.toLocaleString();
    document.getElementById('lvlup-moves').textContent = movesLeft;

    lvlUpModal.classList.add('active');
  }

  function gameOver() {
    isBoardLocked = true;
    GameAudio.playGameOver();

    if (score > highScore) {
      highScore = score;
      updateStats();
    }

    document.getElementById('gameover-score').textContent = score.toLocaleString();
    document.getElementById('gameover-target-display').textContent = targetScore;

    gameOverModal.classList.add('active');
  }

  document.getElementById('next-level-btn').addEventListener('click', () => {
    lvlUpModal.classList.remove('active');
    
    // Scale game difficulties
    currentLevel++;
    if (score > highScore) {
      highScore = score;
    }
    score = 0;
    movesLeft = 30 - Math.min(10, currentLevel); // fewer moves for higher levels
    targetScore = Math.floor(1500 * Math.pow(1.5, currentLevel - 1));

    // Reset boosters count to reward player
    boosters.hammer = Math.min(3, boosters.hammer + 1);
    boosters.color = Math.min(3, boosters.color + 1);
    boosters.shuffle = Math.min(3, boosters.shuffle + 1);
    document.getElementById('hammer-count').textContent = boosters.hammer;
    document.getElementById('color-count').textContent = boosters.color;
    document.getElementById('shuffle-count').textContent = boosters.shuffle;

    updateStats();
    initBoard();
  });

  document.getElementById('restart-game-btn').addEventListener('click', () => {
    gameOverModal.classList.remove('active');
    resetGame();
  });

  function resetGame() {
    score = 0;
    currentLevel = 1;
    targetScore = 1500;
    movesLeft = 30;
    boosters = { hammer: 1, color: 1, shuffle: 1 };
    
    document.getElementById('hammer-count').textContent = boosters.hammer;
    document.getElementById('color-count').textContent = boosters.color;
    document.getElementById('shuffle-count').textContent = boosters.shuffle;
    
    updateStats();
    initBoard();
  }

  // --- Leaderboard Logic ---
  const leadModal = document.getElementById('modal-leaderboard');
  const leadBody = document.getElementById('leaderboard-body');

  function getLeaderboard() {
    const list = localStorage.getItem('candy-leaderboard');
    return list ? JSON.parse(list) : [
      { name: "SweetsKing", level: 5, score: 18500 },
      { name: "CandyQueen", level: 3, score: 7200 },
      { name: "SugarRush", level: 2, score: 3400 }
    ];
  }

  function displayLeaderboard() {
    const list = getLeaderboard();
    leadBody.innerHTML = '';
    list.forEach((item, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${item.name}</td>
        <td>${item.level}</td>
        <td>${item.score.toLocaleString()}</td>
      `;
      leadBody.appendChild(row);
    });
  }

  document.getElementById('submit-score-btn').addEventListener('click', () => {
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim() || "Player";
    
    let list = getLeaderboard();
    list.push({ name, level: currentLevel, score });
    list.sort((a, b) => b.score - a.score);
    list = list.slice(0, 5); // Keep top 5

    localStorage.setItem('candy-leaderboard', JSON.stringify(list));
    
    nameInput.value = '';
    gameOverModal.classList.remove('active');
    
    // Show leaderboard after submitting
    displayLeaderboard();
    leadModal.classList.add('active');
  });

  // --- Modals Toggle Controls ---
  const rulesModal = document.getElementById('modal-rules');

  document.getElementById('close-rules-btn').addEventListener('click', () => {
    rulesModal.classList.remove('active');
    resetGame();
  });

  document.getElementById('rules-btn').addEventListener('click', () => {
    rulesModal.classList.add('active');
  });

  document.getElementById('leaderboard-btn').addEventListener('click', () => {
    displayLeaderboard();
    leadModal.classList.add('active');
  });

  document.getElementById('close-leaderboard-btn').addEventListener('click', () => {
    leadModal.classList.remove('active');
  });

  // --- Setting Configurations toggles ---
  themeSelect.addEventListener('change', (e) => {
    const theme = e.target.value;
    document.body.className = `theme-${theme}`;
    localStorage.setItem('candy-theme', theme);
  });

  soundToggleBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    localStorage.setItem('candy-sound', soundOn);
    GameAudio.enable(soundOn);

    if (soundOn) {
      soundToggleBtn.classList.add('active');
      soundStatusIcon.textContent = '🔊';
      soundToggleBtn.innerHTML = '<span id="sound-status-icon">🔊</span> On';
      GameAudio.init();
    } else {
      soundToggleBtn.classList.remove('active');
      soundStatusIcon.textContent = '🔇';
      soundToggleBtn.innerHTML = '<span id="sound-status-icon">🔇</span> Off';
    }
  });

  // Load High Score
  const savedBest = localStorage.getItem('candy-highscore');
  if (savedBest) {
    highScore = parseInt(savedBest);
  }
  updateStats();
});
