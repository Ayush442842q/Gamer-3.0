# GAAMEER | Candy Crush Saga Autonomous Bot & Web Dashboard

 Gaaameer is a premium, real-time gaming automation platform that combines computer vision (OpenCV), simulated solvers (NumPy), and low-latency hardware control (ADB) with a sleek React-based control dashboard hosted on Vercel. 

With Gaaameer, you can control, calibrate, and watch the bot play the official Candy Crush Saga mobile game on your Android device directly from your web browser.

---

## 🚀 Key Features

* **Real-time Mirroring**: Streams your phone screen at low latency directly onto the web dashboard canvas.
* **Auto-Calibration**: Highlights the game board on the screen. Click **Auto Detect** to dynamically scan the screen and align coordinates automatically, or adjust sliders manually.
* **OpenCV Classification**: Uses multi-template matching to classify standard candies and identify special types (Striped, Wrapped, Color Bombs).
* **Simulated Move Solver**: Uses a greedy look-ahead simulation that evaluates all 112 adjacent swaps, scoring them by match sizes, cascading chains, and special combo priorities.
* **Automated secure Tunneling**: Integrates `pyngrok` in the backend. When launched, it automatically establishes a secure tunnel and prints your `wss://` WebSocket URL.
* **Human-like Swiping & Tapping**: Generates random coordinate jitter (±4px), uses swipe-based touch holds (100ms–200ms) to ensure clicks register reliably on Motorola/fast devices, and applies slower, device-compatible swipe speeds (150ms–400ms) to avoid input dropping.
* **Remote Gestures**: Click anywhere on the dashboard's mirror canvas to send manual touch coordinates back to the phone screen.

---

## 🛠️ Technology Stack

* **Backend (Local PC)**: Python 3.10+, FastAPI, Uvicorn, OpenCV (`cv2`), Pillow, NumPy, `pyngrok`.
* **Frontend (Vercel)**: React, Vite, Vanilla CSS (harmonious dark/neon theme, glassmorphic panels).
* **Bridge**: Android Debug Bridge (ADB) over USB or local Wi-Fi.

---

## 📂 Repository Structure

```
.
├── LICENSE                    # MIT License
├── README.md                  # Root documentation
├── .gitignore                 # Root Git ignore rules
│
├── local_bot/                 # Local Python Runner (FastAPI Server)
│   ├── config.py              # Calibration boundaries, device variables & constants
│   ├── capture.py             # ADB frame grabber and settle verification
│   ├── classifier.py          # OpenCV grid division and template matcher
│   ├── solver.py              # Math solver for match-3 states
│   ├── input.py               # Humanized ADB shell touch commands
│   ├── state.py               # Popup and complete detection
│   ├── server.py              # WebSocket server & config updates REST API
│   ├── requirements.txt       # Backend dependencies
│   ├── templates/             # Candy match sprite templates
│   └── screens/               # State popup templates
│
└── web_dashboard/             # Frontend Dashboard (Vite React Client)
    ├── package.json           # React dependencies & npm scripts
    ├── index.html             # Entry template
    ├── vercel.json            # Vercel URL rewrite rules for client-side routing
    └── src/
        ├── index.css          # Design system, colors, variables, custom scrollbars
        ├── App.css            # Component-level layout & mirror grid stylesheet
        ├── App.jsx            # Live stream, console logging, config post requests
        └── main.jsx           # React app mounter
```

---

## 🏎️ Getting Started

### Prerequisites
* Have **Python 3.10+** installed on your PC.
* Have **Node.js 18+** installed on your PC (to run the frontend locally, optional).
* Enable **USB Debugging** on your Android phone under Developer Options and plug it into your PC.

### Step 1: Start the Local Bot Backend
1. Connect your device and check if it is recognized:
   ```bash
   adb devices
   ```
2. Navigate to the `local_bot` directory and install the requirements:
   ```bash
   cd local_bot
   pip install -r requirements.txt
   ```
3. *(Optional)* Provide your ngrok authtoken to use the automated secure web tunnel:
   ```bash
   # On Windows (PowerShell)
   $env:NGROK_AUTHTOKEN="your_token_here"
   ```
4. Start the FastAPI WebSocket server:
   ```bash
   uvicorn server:app --host 0.0.0.0 --port 8000
   ```
   *Take note of the printed WebSocket tunnel link (e.g. `wss://xxxx.ngrok-free.app/ws`).*

### Step 2: Deploy the Web Dashboard to Vercel
1. Log in to [Vercel](https://vercel.com).
2. Create a **New Project** and import your fork of this repository.
3. In the project settings, set the **Root Directory** to `web_dashboard`. Vercel will automatically build the React project using the default Vite preset (`npm run build`).
4. Click **Deploy**. Vercel will host the dashboard at your custom subdomain (e.g., `gaameer.vercel.app`).

### Step 3: Run the Bot
1. Open your Vercel URL in a web browser.
2. Enter the backend's `wss://` URL into the Connection bar in the top-right header and click **Connect**.
3. Launch Candy Crush Saga on your phone and enter a level.
4. On the dashboard's **Grid Calibration** panel, click **Auto Detect** to automatically align the board boundary using dynamic color calibration, or adjust the sliders manually and click **Apply**.
5. Click **START AUTO-PLAY** and watch the bot play autonomously!

---

## 📝 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
