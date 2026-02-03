# Game of Cells 🦠🔋

Game of Cells is a strategic infrastructure management simulation built with React. Players must manage a network of `MAP_LEVELS` levels of hexagonal gNodeBs (`COVERAGE_CELLS_COUNT` + `CAPACITY_CELLS_COUNT` per level) to provide continuous connectivity to a variety of dynamic minions while optimizing for minimum energy consumption.

## 🎯 The Mission
Complete all assigned tasks (`TARGET_STEPS`) while maintaining **1 Minion Energy** efficiency. You must ensure that every minion on the map is "In Service" at all times. If any minion enters a cell that is powered off or moves out of coverage, the simulation fails.

## 🎮 Core Gameplay Loop
The game progresses through discrete steps where you act as the **Network Orchestrator**.

### 1️⃣ Information Gathering
Review available telemetry from each minion group. Telemetry includes current cell ID, absolute coordinates, and predicted next locations (depending on minion type).

### 2️⃣ Manual Grid Orchestration
Click on individual hexagonal cells in the **Cell Coverage Map** to toggle them **ON** or **OFF** for the upcoming step. Use minion predictions to minimize active cells while ensuring full coverage.

### 3️⃣ Execution & Evaluation
Click the **NEXT STEP** button to advance the clock.
- **Movement**: All minions move simultaneously based on their AI, restricted zones, and max move constraints.
- **Connectivity Check**: Every minion must be covered by an **Active** gnb.
- **Capacity Check**: Coverage Cells must not exceed `COVERAGE_LIMIT_MBPS`.

### 4️⃣ Step Outcome
- **Success**: Energy is consumed (`MINION_ENERGY_COST` per Active Cell) and you move to the next step.
- **Failure**: If a connection is lost or throughput is exceeded, the simulation terminates (**Game Over**).

- **Victory Condition**: Complete the `TARGET_STEPS` without service failure.
- **Ranking**: Players are ranked by total steps completed, then by energy efficiency.
- **Predictive Switching**: Use minion data to keep only the strictly necessary cells active.

## �️ Controls Reference
| Key/Button | Action |
| :--- | :--- |
| **`GEN`** | Generate/Reset the entire map and minions. |
| **`STEP`** | Advance the simulation by one step. |
| **`HINT`** | Momentarily show the [Physical Map](#2️⃣-physical-map-physical_mapyaml). |
| **`Mouse Click`** | Toggle a Cell **ON/OFF** in the 3D Map. |
| **`Right Click + Drag`** | Rotate the Orbit Camera. |
| **`Scroll`** | Zoom in/out of the 3D Grid. |

## 🤖 Minions
Each minion has unique movement patterns and data-sharing capabilities:

| Minion | Current Cell | Current Abs Location | Next Step Abs Location | Level Transition | Movement | Max Move | Throughput Req |
| :--- | :---: | :---: | :---: | :--- | :--- | :---: | :---: |
| **Human** | ✅ | ❌ | ❌ | Specific points | Any direction | `HUMAN_MAX_MOVE` | `HUMAN_REQ_THROUGHPUT` |
| **Humanoid Robot** | ✅ | ✅ | ❌ | Specific points | Any direction (Restricted) | `HUMANOID_MAX_MOVE` | `HUMANOID_REQ_THROUGHPUT` |
| **Dog Robot** | ✅ | ✅ | ✅ | Specific points | Any direction (Restricted) | `DOG_ROBOT_MAX_MOVE` | `DOG_ROBOT_REQ_THROUGHPUT` |
| **Turtle Bot** | ✅ | ✅ | ✅ | Specific points | Any direction (Restricted) | `TURTLE_BOT_MAX_MOVE` | `TURTLE_BOT_REQ_THROUGHPUT` |
| **Drone** | ✅ | ✅ | ✅ | **Any point** | Any direction (Restricted) | `DRONE_MAX_MOVE` | `DRONE_REQ_THROUGHPUT` |

## 📶 Cell Types (gNodeBs)
Each hexagonal cell in the **Cell Coverage Map** can be one of two types:
- **Coverage Cell**:
  - **Service Limit**: `COVERAGE_LIMIT_MBPS` (default, configurable).
  - **Radius**: `COVERAGE_CELL_RADIUS` (Larger area, lower capacity).
  - **Throughput**: Shared among connected minions based on their `Throughput Req`.
- **Capacity Cell**:
  - **Service Limit**: **Unlimited** throughput.
  - **Radius**: `CAPACITY_CELL_RADIUS` (Smaller area, high density).
  - **Logic**: If a minion is within the radius of both a Coverage and a Capacity cell, it will automatically connect to the **Capacity Cell**.

---

## 🖥️ User Interface & Layout
The application is structured as a dual-pane dashboard:

```text
|-------------------|-------------------|
|                   |      PANEL        |
|                   |-------------------|
|       MAP         |  STEP  |  GEN     |
|       (3D)        |-------------------|
|                   |    PARAMETERS     |
|                   |   CONFIGURATION   |
|-------------------|-------------------|
```

### 🧱 Component Breakdown
1. **Map View (Left Pane)**:
   - **Environment**: Immersive **3D viewport** using React Three Fiber.
   - **Levels**: Vertical stack of `MAP_LEVELS` hexagonal planes.
   - **Interaction**: Click cells to toggle state (ON/OFF), orbit/zoom to inspect minions.

2. **Control Panel (Right Pane)**:
   - **Action Bar (Top)**:
     - **`STEP` Button**: Advance the simulation by one step.
     - **`GEN` Button**: Generate/Regenerate the map and spawn minions.
     - **`HINT` Button**: Briefly toggle the visibility of the **Physical Map**.
   - **Configuration Area (Bottom)**: 
     - **Minion Spawning Controls**: Radio buttons for activation and text boxes for quantity.
     - **Environment Settings**: Real-time adjustment of configuration macros.

## 🗺️ Infrastructure & Map Layers
Each level consists of two primary functional layers:
1. **Lower Layer (Physical Map)**: Manages level transition areas (zones), restricted robotic zones, and physical obstacles.
2. **Upper Layer (Cell Coverage Map)**: Manages the hexagonal gNodeB grid, cell activation, and connection logic.

## ⚙️ Simulation Configuration
The **Control Panel** allows adjustment of:
- **📐 Grid Geometry**: Set `COVERAGE_CELLS_COUNT`, `CAPACITY_CELLS_COUNT`, and `MAP_LEVELS`.
- **👥 Minion Spawning**: Control `*_ENABLED` and `*_COUNT` for each type.
- **🏃 Movement Physics**: Adjust `MAX_MOVE` distances.
- **🚥 Network Parameters**: Global caps and radius settings.

## �️ Configuration Macros
| Macro | Explanation | Default Value |
| :--- | :--- | :--- |
| `TARGET_STEPS` | Total steps required to win. | `100` |
| `MINION_ENERGY_COST` | Energy per active cell per step. | `1.0` |
| `MAP_LEVELS` | Total vertical floors. | `3` |
| `COVERAGE_CELLS_COUNT` | Coverage units per level. | `40` |
| `CAPACITY_CELLS_COUNT` | Capacity units per level. | `10` |
| `COVERAGE_LIMIT_MBPS` | Throughput cap for Coverage. | `100 Mbps` |
| `CAPACITY_CELL_RADIUS` | Radius for Capacity Cell. | `20.0 m` |
| `COVERAGE_CELL_RADIUS` | Radius for Coverage Cell (3x). | `60.0 m` |

*(Detailed minion macros omitted for brevity in this overview, available in full config panel.)*

## 💾 Map Persistence (YAML Schema)
### 1️⃣ Network Map (`network_map.yaml`)
```yaml
distance_between_levels: 10.0
levels:
  - id: 0
    cells:
      - id: "cell_0_0"
        type: "coverage"
        center: { x: 0.0, y: 0.0, z: 0.0 }
        radius: 60.0
```

### 2️⃣ Physical Map (`physical_map.yaml`)
```yaml
levels:
  - id: 0
    transition_areas:
      - id: "stair_gate_01"
        type: "circle"
        center: { x: 50.0, z: 50.0 }
        radius: 3.0
        connects_to: 1
    restricted_zones:
      - type: "circle"
        center: { x: 20.0, z: 20.0 }
        radius: 15.0
        allowed_minions: ["drone", "dog_robot"]
```

## 🚀 Getting Started

### 🐳 Docker Setup (Recommended)
If you have Docker installed, you can run the environment with a single command:

1. **Start Environment**:
   ```bash
   docker-compose up --build
   ```
2. **Access App**: Open `http://localhost:5173` in your browser.

### 🛠️ Local Setup (Manual)
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start Dev Server**:
   ```bash
   npm run dev
   ```
3. **Initialize World**: Click the **GENERATE** button in the sidebar to spawn the grid and minions.

## 🛠️ Tech Stack
- **Framework**: React 18+ (Vite)
- **3D Engine**: Three.js + **React Three Fiber**
- **Icons**: Lucide React
- **Styling**: Vanilla CSS (Cyberpunk Theme)
