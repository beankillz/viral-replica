const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('ffmpeg-static');
const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');

console.log('Testing FFmpeg...');
console.log('FFmpeg Path:', ffmpegInstaller);

if (!fs.existsSync(ffmpegInstaller)) {
    console.error('ERROR: FFmpeg binary not found at path!');
} else {
    console.log('FFmpeg binary exists.');
}

ffmpeg.setFfmpegPath(ffmpegInstaller);

ffmpeg.getAvailableFormats(function (err, formats) {
    if (err) {
        console.error('ERROR: FFmpeg execution failed:', err.message);
    } else {
        console.log('FFmpeg execution successful. Formats available.');
    }
});

console.log('Testing Tesseract...');
(async () => {
    try {
        const worker = await createWorker('eng');
        console.log('Tesseract worker created successfully.');
        await worker.terminate();
        console.log('Tesseract test passed.');
    } catch (error) {
        console.error('ERROR: Tesseract failed:', error);
    }
})();
