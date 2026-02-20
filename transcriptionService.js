const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const config = require('./config');
const { AssemblyAI } = require('assemblyai');

class TranscriptionService {
    constructor() {
        this.client = new AssemblyAI({
            apiKey: config.ASSEMBLY_AI_API_KEY,
        });
    }

    async transcribe(inputPath) {
        if (!config.ASSEMBLY_AI_API_KEY || config.ASSEMBLY_AI_API_KEY === "") {
            console.warn("[TranscriptionService] No hay AssemblyAI API Key. Usando simulación.");
            return "Hello my name is Carlos";
        }

        const mp3Path = inputPath.replace(/\.[^/.]+$/, "") + "_converted.mp3";

        try {
            // Pre-procesar audio: Convertir a MP3 para asegurar compatibilidad y menor peso en subida
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .toFormat('mp3')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(mp3Path);
            });

            console.log(`[TranscriptionService] Audio pre-procesado: ${mp3Path}`);

            const params = {
                audio: mp3Path,
                language_detection: true,
                speech_models: ["universal-3-pro", "universal-2"]
            };

            const transcript = await this.client.transcripts.transcribe(params);

            // Limpiar archivo temporal mp3
            if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);

            if (transcript.status === 'error') {
                console.error(`[TranscriptionService] Error de AssemblyAI: ${transcript.error}`);
                return null;
            }

            return transcript.text.trim();
        } catch (error) {
            console.error(`[TranscriptionService] Error transcribiendo: ${error.message}`);
            return null;
        }
    }
}

module.exports = new TranscriptionService();
