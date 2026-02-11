// --- PAGE NAVIGATION ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(pageId + '-page');
    if (target) target.classList.add('active');

    if(pageId === 'sim') {
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    }
}

// --- SIMULATION STATE ---
let fadeSpeed = 0.99, forceMultiplier = 10, baseHue = 200;
let editMode = "smoke", isMouseDown = false, highPerformance = false;
const N = 64;
let iter = 10;
const size = (N + 2) * (N + 2);

// Buffers
let dens = new Float32Array(size).fill(0), dens_prev = new Float32Array(size).fill(0);
let u = new Float32Array(size).fill(0), v = new Float32Array(size).fill(0);
let u_prev = new Float32Array(size).fill(0), v_prev = new Float32Array(size).fill(0);
let obstacles = new Uint8Array(size).fill(0);
let canvas, ctx;

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d', { alpha: false });

    const listen = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
    };

    listen('perfBtn', 'click', (e) => {
        highPerformance = !highPerformance;
        iter = highPerformance ? 4 : 10;
        e.target.innerText = highPerformance ? "Performance: High" : "Performance: Normal";
    });

    listen('modeBtn', 'click', (e) => {
        editMode = (editMode === "smoke") ? "wall" : "smoke";
        e.target.innerText = `Mode: ${editMode === "smoke" ? "Adding Smoke" : "Building Walls"}`;
    });

    listen('clearBtn', 'click', () => {
        dens.fill(0); u.fill(0); v.fill(0); obstacles.fill(0);
    });

    listen('fadeSlider', 'input', (e) => fadeSpeed = parseFloat(e.target.value));
    listen('forceSlider', 'input', (e) => forceMultiplier = parseInt(e.target.value));
    listen('hueSlider', 'input', (e) => baseHue = parseInt(e.target.value));

    document.querySelector('.controls').onmousedown = (e) => e.stopPropagation();

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
    window.dispatchEvent(new Event('resize'));

    window.onmousedown = () => isMouseDown = true;
    window.onmouseup = () => isMouseDown = false;
    window.onmousemove = handleInput;

    requestAnimationFrame(step);
});

// --- PHYSICS ENGINE ---
function handleInput(e) {
    if (!isMouseDown) return;
    const rect = canvas.getBoundingClientRect();
    let x = Math.floor(((e.clientX - rect.left) / rect.width) * N) + 1;
    let y = Math.floor(((e.clientY - rect.top) / rect.height) * N) + 1;

    if (x > 0 && x <= N && y > 0 && y <= N) {
        let idx = IX(x, y);
        if (editMode === "smoke") {
            // Slider now affects mouse force
            u[idx] += e.movementX * (forceMultiplier * 0.2);
            v[idx] += e.movementY * (forceMultiplier * 0.2);
            dens[idx] += 150;
        } else {
            // Brushing walls
            for(let i=-1; i<=1; i++) {
                for(let j=-1; j<=1; j++) {
                    let oIdx = IX(x+i, y+j);
                    obstacles[oIdx] = 1;
                    u[oIdx] = 0; v[oIdx] = 0; // Stop air inside wall
                }
            }
        }
    }
}

function step() {
    // Fan Source (Slider affects speed here too)
    for (let j = 1; j <= N; j++) {
        let idx = IX(1, j);
        if (!obstacles[idx]) {
            u[idx] += (forceMultiplier * 0.15); 
            v[idx] += Math.sin(Date.now() * 0.005 + j) * (forceMultiplier * 0.05);
            dens[idx] += 3.0;
        }
    }

    const dt = 0.1;
    u_prev.set(u); v_prev.set(v);
    advect(1, u, u_prev, u_prev, v_prev, dt);
    advect(2, v, v_prev, u_prev, v_prev, dt);
    project(u, v, u_prev, v_prev);
    dens_prev.set(dens);
    advect(0, dens, dens_prev, u, v, dt);

    for (let i = 0; i < size; i++) {
        dens[i] *= fadeSpeed;
        u[i] *= 0.98; v[i] *= 0.98;
    }

    render();
    requestAnimationFrame(step);
}

function render() {
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cw = canvas.width / N, ch = canvas.height / N;

    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= N; j++) {
            let idx = IX(i, j);
            
            // DRAW WALLS
            if (obstacles[idx]) {
                dens[idx] = 0; 
                ctx.fillStyle = "#333";
                ctx.fillRect((i-1)*cw, (j-1)*ch, cw+1, ch+1);
            } 
            // DRAW SMOKE
            else if (dens[idx] > 0.1) {
                let d = dens[idx];
                ctx.fillStyle = `hsla(${baseHue}, 80%, ${Math.min(20+d, 80)}%, ${Math.min(d/50, 0.8)})`;
                ctx.fillRect((i-1)*cw, (j-1)*ch, cw+1.2, ch+1.2);
            }
        }
    }
}

// Math Helpers
function IX(x, y) { return x + (N + 2) * y; }

// FIXED BOUNDARY CONDITIONS FOR WALLS
function set_bnd(b, x) {
    for (let i = 1; i <= N; i++) {
        // Screen edges
        x[IX(0, i)] = b == 1 ? -x[IX(1, i)] : x[IX(1, i)];
        x[IX(N + 1, i)] = b == 1 ? -x[IX(N, i)] : x[IX(N, i)];
        x[IX(i, 0)] = b == 2 ? -x[IX(i, 1)] : x[IX(i, 1)];
        x[IX(i, N + 1)] = b == 2 ? -x[IX(i, N)] : x[IX(i, N)];
    }
    
    // Internal Wall Collisions
    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= N; j++) {
            if (obstacles[IX(i, j)]) {
                if (b == 1) x[IX(i, j)] = -x[IX(i - 1, j)] || -x[IX(i + 1, j)];
                else if (b == 2) x[IX(i, j)] = -x[IX(i, j - 1)] || -x[IX(i, j + 1)];
                else x[IX(i, j)] = 0;
            }
        }
    }
}

function advect(b, d, d0, velocX, velocY, dt) {
    let dt0 = dt * N;
    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= N; j++) {
            let x = i - dt0 * velocX[IX(i, j)], y = j - dt0 * velocY[IX(i, j)];
            if (x < 0.5) x = 0.5; if (x > N + 0.5) x = N + 0.5;
            if (y < 0.5) y = 0.5; if (y > N + 0.5) y = N + 0.5;
            let i0 = Math.floor(x), i1 = i0 + 1, j0 = Math.floor(y), j1 = j0 + 1;
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
            div[IX(i, j)] = -0.5 * (velocX[IX(i+1,j)] - velocX[IX(i-1,j)] + velocY[IX(i,j+1)] - velocY[IX(i,j-1)]) / N;
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
                x[IX(i,j)] = (x0[IX(i,j)] + a * (x[IX(i-1,j)] + x[IX(i+1,j)] + x[IX(i,j-1)] + x[IX(i,j+1)])) * invC;
            }
        }
        set_bnd(b, x);
    }
}