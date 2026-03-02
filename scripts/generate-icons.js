// scripts/generate-icons.js
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

function createIcon(size, text) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background - Dark rounded rect
    ctx.fillStyle = '#0d0f14'; // Theme color
    ctx.beginPath();
    const radius = size * 0.2;
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();

    // Simple geometric center - A bright blue circle
    ctx.fillStyle = '#3b82f6'; // Tailwind blue-500
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Inner white dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.08, 0, Math.PI * 2);
    ctx.fill();

    return canvas.toBuffer('image/png');
}

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

// Generate the sizes needed for a PWA
const sizes = [192, 512];
sizes.forEach(size => {
    fs.writeFileSync(path.join(publicDir, `icon-${size}.png`), createIcon(size));
    console.log(`Generated icon-${size}.png`);
});

// Also create a tiny one for favicon.ico replacement
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createIcon(32));
console.log('Generated favicon.ico');

// Create manifest.json
const manifest = {
    "name": "Coki Assistant",
    "short_name": "Coki",
    "theme_color": "#0d0f14",
    "background_color": "#0d0f14",
    "display": "standalone",
    "orientation": "portrait",
    "scope": "/",
    "start_url": "/dashboard/today",
    "icons": [
        {
            "src": "/icon-192.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "/icon-512.png",
            "sizes": "512x512",
            "type": "image/png"
        }
    ]
};

fs.writeFileSync(path.join(publicDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Generated manifest.json');
