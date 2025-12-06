import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";
import fs from "fs";
import os from "os";

// Detect Platform
const platform = os.platform();
const arch = os.arch();

console.log(`OS detected: ${platform} (${arch})`);

// Determine the expected binary name
const binaryName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

// PURE LOCK: Force use of local binary if it exists in node_modules
// This bypasses any weird path issues with \\ROOT or other environment mismatches
const localFfmpegPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', binaryName);

let finalPath = ffmpegPath;

if (fs.existsSync(localFfmpegPath)) {
    console.log(`🔒 Force-using local FFmpeg binary at: ${localFfmpegPath}`);
    finalPath = localFfmpegPath;
} else if (ffmpegPath) {
    console.log(`⚠️ Local binary not found, using package path: ${ffmpegPath}`);

    // FIX FOR RENDER DEPLOYMENT
    // ffmpeg-static might return a path starting with /ROOT/ on some cloud environments
    // We need to rewrite this to the actual specific current working directory
    if (ffmpegPath.includes('/ROOT/')) {
        console.log('⚠️ Detected invalid ROOT path from ffmpeg-static. Attempting to fix...');
        // Replace /ROOT with the current working directory
        // The path usually looks like: /ROOT/node_modules/ffmpeg-static/ffmpeg
        // We want: /opt/render/project/src/node_modules/ffmpeg-static/ffmpeg
        finalPath = ffmpegPath.replace('/ROOT', process.cwd());
        console.log(`✅ Corrected FFmpeg path to: ${finalPath}`);
    }
} else {
    console.warn("❌ FFmpeg binary not found in node_modules or package export. Relying on system PATH.");
    finalPath = null;
}

if (finalPath) {
    // Verify executability on Linux/Unix
    if (platform !== 'win32') {
        try {
            fs.chmodSync(finalPath, '755');
            console.log('✅ Set executable permissions for FFmpeg binary');
        } catch (e) {
            console.warn('⚠️ Could not set executable permissions:', e.message);
        }
    }
    ffmpeg.setFfmpegPath(finalPath);
}

export default ffmpeg;
