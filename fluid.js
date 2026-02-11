const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const N = 64; // Grid size
const iter = 10; // Physics precision
const size = (N + 2) * (N + 2);

// These are our "Buffers"
let dens = new Float32Array(size).fill(0);      // Density (Smoke)
let u = new Float32Array(size).fill(0);         // Velocity X
let v = new Float32Array(size).fill(0);         // Velocity Y
let u_prev = new Float32Array(size).fill(0);    // Previous Velocity X
let v_prev = new Float32Array(size).fill(0);    // Previous Velocity Y
let dens_prev = new Float32Array(size).fill(0); // Previous Density

// Resize canvas to fill screen
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Helper to find the index of a cell at (x, y)
function IX(x, y) {
    return x + (N + 2) * y;
}

let isMouseDown = false;

window.addEventListener('mousedown', () => isMouseDown = true);
window.addEventListener('mouseup', () => isMouseDown = false);
window.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;

    // Convert screen coordinates to grid coordinates
    let x = Math.floor((e.clientX / window.innerWidth) * N) + 1;
    let y = Math.floor((e.clientY / window.innerHeight) * N) + 1;

    if (x > 0 && x <= N && y > 0 && y <= N) {
        let index = IX(x, y);
        u[index] += e.movementX * 10; // Add force
        v[index] += e.movementY * 10;
        dens[index] += 100;           // Add "smoke"
    }
});

function render() {
    // 1. Clear the background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellWidth = canvas.width / N;
    const cellHeight = canvas.height / N;

    // 2. Loop through the grid (skipping the boundary cells)
    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= N; j++) {
            let d = dens[IX(i, j)]; // Get density at this cell
            
            if (d > 0) {
                // Map density to a white/blue color
                // Math.min(d, 255) ensures we don't go over the max color value
                let brightness = Math.min(d, 255);
                ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness + 50})`;
                
                // Draw the cell
                ctx.fillRect((i - 1) * cellWidth, (j - 1) * cellHeight, cellWidth + 1, cellHeight + 1);
            }
        }
    }
}

function fade() {
    for (let i = 0; i < size; i++) {
        dens[i] *= 0.99; // Slowly "evaporate" the smoke every frame
        u[i] *= 0.99;    // Friction: Slow down the wind speed
        v[i] *= 0.99;
    }
}

function step() {
    // This is where the Navier-Stokes math will eventually go
    // For now, we just fade and render
    fade();
    render();
    
    requestAnimationFrame(step);
}

// Start the loop!
step();