import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";
import fs from "fs";

// PURE LOCK: Force use of local binary if it exists
// This bypasses any weird path issues with \\ROOT or other environment mismatches
const localFfmpegPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');

let finalPath = ffmpegPath;

if (fs.existsSync(localFfmpegPath)) {
    console.log(`🔒 Force-using local FFmpeg binary at: ${localFfmpegPath}`);
    finalPath = localFfmpegPath;
} else if (ffmpegPath) {
    console.log(`⚠️ Local binary not found, using package path: ${ffmpegPath}`);
    if (ffmpegPath.includes('ROOT')) {
        console.warn('⚠️ Path contains ROOT, but local binary was not found at expected location.');
    }
} else {
    console.warn("❌ FFmpeg binary not found in node_modules or package export. Relying on system PATH.");
    finalPath = null;
}

if (finalPath) {
    ffmpeg.setFfmpegPath(finalPath);
}

export default ffmpeg;
