/**
 * Advanced Fluid Dynamics Solver
 * Fixed: Scope issues and UI initialization
 */

// 1. Configuration & State
let fadeSpeed = 0.99;
let forceMultiplier = 10; 
let baseHue = 200;
let editMode = "smoke"; 
let isMouseDown = false;
let highPerformance = false; 

const N = 64; 
let iter = 10; // Global let: Accessible by all functions
const size = (N + 2) * (N + 2);

// 2. Buffers
let dens = new Float32Array(size).fill(0);
let dens_prev = new Float32Array(size).fill(0);
let u = new Float32Array(size).fill(0);
let v = new Float32Array(size).fill(0);
let u_prev = new Float32Array(size).fill(0);
let v_prev = new Float32Array(size).fill(0);
let obstacles = new Uint8Array(size).fill(0);

let canvas, ctx;

// 3. Setup (Simplified and safer)
window.onload = () => {
    canvas = document.getElementById('canvas');
    if (!canvas) return console.error("Canvas not found!");
    ctx = canvas.getContext('2d', { alpha: false });

    // UI Elements
    const perfBtn = document.getElementById('perfBtn');
    const modeBtn = document.getElementById('modeBtn');
    const clearBtn = document.getElementById('clearBtn');
    const controls = document.querySelector('.controls');

    // UI Bindings
    if (perfBtn) {
        perfBtn.onclick = (e) => {
            highPerformance = !highPerformance;
            iter = highPerformance ? 4 : 10;
            e.target.innerText = highPerformance ? "Performance: High (Fast)" : "Performance: Normal";
            e.target.style.background = highPerformance ? "#27ae60" : "#444";
        };
    }

    if (modeBtn) {
        modeBtn.onclick = (e) => {
            editMode = (editMode === "smoke") ? "wall" : "smoke";
            e.target.innerText = `Mode: ${editMode === "smoke" ? "Adding Smoke" : "Building Walls"}`;
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            dens.fill(0); u.fill(0); v.fill(0);
            u_prev.fill(0); v_prev.fill(0); dens_prev.fill(0);
            obstacles.fill(0);
        };
    }

    if (controls) {
        controls.addEventListener('mousedown', (e) => e.stopPropagation());
        controls.addEventListener('mousemove', (e) => e.stopPropagation());
    }

    // Connect Sliders
    document.getElementById('fadeSlider').oninput = (e) => fadeSpeed = parseFloat(e.target.value);
    document.getElementById('forceSlider').oninput = (e) => forceMultiplier = parseInt(e.target.value);
    document.getElementById('hueSlider').oninput = (e) => baseHue = parseInt(e.target.value);

    // Canvas Resize
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Mouse Listeners
    window.addEventListener('mousedown', () => isMouseDown = true);
    window.addEventListener('mouseup', () => isMouseDown = false);
    window.addEventListener('mousemove', handleInput);

    // Start Loop
    requestAnimationFrame(step);
};

// 4. Input handling
function handleInput(e) {
    if (!isMouseDown) return;

    let x = Math.floor((e.clientX / window.innerWidth) * N) + 1;
    let y = Math.floor((e.clientY / window.innerHeight) * N) + 1;

    if (x > 0 && x <= N && y > 0 && y <= N) {
        let index = IX(x, y);
        if (editMode === "smoke") {
            u[index] += e.movementX * (forceMultiplier * 0.4); 
            v[index] += e.movementY * (forceMultiplier * 0.4);
            dens[index] += 180; 
        } else {
            obstacles[index] = 1; 
        }
    }
}

// 5. Physics Step
function step() {
    // 1. Persistent wobbling source (The Fan)
    for (let j = 1; j <= N; j++) {
        let idx = IX(1, j);
        if (obstacles[idx] === 0) {
            u[idx] += 2.2; 
            v[idx] += Math.sin(Date.now() * 0.004 + j) * 0.6; 
            dens[idx] += 3.5; 
        }
    }

    // BUOYANCY LOOP REMOVED - Smoke will no longer drift upward automatically.

    const dt = 0.1;
    u_prev.set(u); v_prev.set(v);
    advect(1, u, u_prev, u_prev, v_prev, dt);
    advect(2, v, v_prev, u_prev, v_prev, dt);
    project(u, v, u_prev, v_prev);

    dens_prev.set(dens);
    advect(0, dens, dens_prev, u, v, dt);

    fade();
    render();
    requestAnimationFrame(step);
}

// 6. Polished Render
function render() {
    if (!ctx) return;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cw = canvas.width / N;
    const ch = canvas.height / N;

    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= N; j++) {
            let idx = IX(i, j);
            let d = dens[idx];

            if (obstacles[idx]) {
                ctx.fillStyle = "#2c3e50"; 
                ctx.fillRect((i - 1) * cw, (j - 1) * ch, cw + 1, ch + 1);
                ctx.strokeStyle = "#3498db"; 
                ctx.lineWidth = 1;
                ctx.strokeRect((i - 1) * cw, (j - 1) * ch, cw, ch);
            } else if (d > 0.1) {
                let alpha = Math.min(d / 45, 0.85); 
                let lightness = Math.min(20 + d, 75); 
                ctx.fillStyle = `hsla(${baseHue}, 85%, ${lightness}%, ${alpha})`;
                ctx.fillRect((i - 1) * cw, (j - 1) * ch, cw + 1.2, ch + 1.2);
            }
        }
    }
}

// Helper Math
function IX(x, y) { return x + (N + 2) * y; }

function fade() {
    for (let i = 0; i < size; i++) {
        dens[i] *= fadeSpeed;
        u[i] *= 0.98; 
        v[i] *= 0.98;
    }
}

function set_bnd(b, x) {
    for (let i = 1; i <= N; i++) {
        x[IX(0, i)] = b == 1 ? -x[IX(1, i)] : x[IX(1, i)];
        x[IX(N + 1, i)] = b == 1 ? -x[IX(N, i)] : x[IX(N, i)];
        x[IX(i, 0)] = b == 2 ? -x[IX(i, 1)] : x[IX(i, 1)];
        x[IX(i, N + 1)] = b == 2 ? -x[IX(i, N)] : x[IX(i, N)];
    }
    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= N; j++) {
            if (obstacles[IX(i, j)]) {
                if (b == 1) x[IX(i, j)] = -x[IX(i - 1, j)];
                else if (b == 2) x[IX(i, j)] = -x[IX(i, j - 1)];
                else x[IX(i, j)] = 0;
            }
        }
    }
}

function advect(b, d, d0, velocX, velocY, dt) {
    let dt0 = dt * N;
    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= N; j++) {
            let x = i - dt0 * velocX[IX(i, j)];
            let y = j - dt0 * velocY[IX(i, j)];
            if (x < 0.5) x = 0.5; if (x > N + 0.5) x = N + 0.5;
            let i0 = Math.floor(x), i1 = i0 + 1;
            if (y < 0.5) y = 0.5; if (y > N + 0.5) y = N + 0.5;
            let j0 = Math.floor(y), j1 = j0 + 1;
            let s1 = x - i0, s0 = 1 - s1, t1 = y - j0, t0 = 1 - t1;
            d[IX(i, j)] = s0 * (t0 * d0[IX(i0, j0)] + t1 * d0[IX(i0, j1)]) +
                         s1 * (t0 * d0[IX(i1, j0)] + t1 * d0[IX(i1, j1)]);
        }
    }
    set_bnd(b, d);
}

function project(velocX, velocY, p, div) {
    for (let j = 1; j <= N; j++) {
        for (let i = 1; i <= N; i++) {
            div[IX(i, j)] = -0.5 * (velocX[IX(i+1,j)] - velocX[IX(i-1,j)] + 
                                   velocY[IX(i,j+1)] - velocY[IX(i,j-1)]) / N;
            p[IX(i, j)] = 0;
        }
    }
    set_bnd(0, div); set_bnd(0, p);
    linear_solve(0, p, div, 1, 4);
    for (let j = 1; j <= N; j++) {
        for (let i = 1; i <= N; i++) {
            velocX[IX(i,j)] -= 0.5 * (p[IX(i+1,j)] - p[IX(i-1,j)]) * N;
            velocY[IX(i,j)] -= 0.5 * (p[IX(i,j+1)] - p[IX(i,j-1)]) * N;
        }
    }
    set_bnd(1, velocX); set_bnd(2, velocY);
}

function linear_solve(b, x, x0, a, c) {
    let invC = 1.0 / c;
    for (let k = 0; k < iter; k++) {
        for (let j = 1; j <= N; j++) {
            for (let i = 1; i <= N; i++) {
                x[IX(i,j)] = (x0[IX(i,j)] + a * (x[IX(i-1,j)] + x[IX(i+1,j)] + 
                             x[IX(i,j-1)] + x[IX(i,j+1)])) * invC;
            }
        }
        set_bnd(b, x);
    }
}