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