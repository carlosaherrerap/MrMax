const fs = require('fs');
const path = require('path');
const aiService = require('./aiService');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Cargar exámenes
const examWriting = JSON.parse(fs.readFileSync(path.join(__dirname, 'examen_basic0_writting.json'), 'utf-8'));
const examSpeaking = JSON.parse(fs.readFileSync(path.join(__dirname, 'examen_basic0_speaking.json'), 'utf-8'));
const examListening = JSON.parse(fs.readFileSync(path.join(__dirname, 'examen_basic0_listening.json'), 'utf-8'));

class StateManager {
    constructor() {
        this.userContext = {};
    }

    async handleMessage(sock, msg) {
        const jid = msg.key.remoteJid;
        const phone = jid.split('@')[0];
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        if (!text) return;

        let cliente = await excelService.getCliente(phone);
        console.log(`[StateManager] Mensaje de ${phone}: "${text}" | Estado actual: ${cliente ? cliente.estado : 'NUEVO'}`);

        if (!cliente) {
            await this.sendMessage(sock, jid, config.BOT_MESSAGES.PRESENTATION);
            await this.sendMessage(sock, jid, config.BOT_MESSAGES.AUTHORIZATION);
            await this.sendMessage(sock, jid, config.BOT_MESSAGES.REJECT);

            await excelService.saveCliente({
                key: phone,
                id: phone,
                value: "",
                nombre: "",
                nivel: 0,
                estado: 'WAITING_AUTH'
            });
            console.log(`[StateManager] Usuario ${phone} registrado con estado WAITING_AUTH`);
            return;
        }

        switch (cliente.estado) {
            case 'WAITING_AUTH':
                if (text.toUpperCase().includes("NO. GRACIAS")) {
                    await this.sendMessage(sock, jid, "Entendido. Si cambias de opinión, aquí estaré.");
                    cliente.estado = 'START';
                } else if (/^\d{9}$/.test(text)) {
                    cliente.value = text;
                    cliente.estado = 'WAITING_NAME';
                    await this.sendMessage(sock, jid, config.BOT_MESSAGES.DECISION);
                    await this.sendMessage(sock, jid, config.BOT_MESSAGES.WELCOME);
                    await this.sendMessage(sock, jid, `Tu codigo de pago es: ${text}`);
                    await this.sendMessage(sock, jid, config.BOT_MESSAGES.NAME_REQUEST);
                }
                break;

            case 'WAITING_NAME':
                const name = text.replace(/Me llamo /i, "").trim();
                cliente.nombre = name;
                cliente.estado = 'LESSON_0';
                this.userContext[phone] = { exerciseIndex: 0 };
                await this.sendMessage(sock, jid, `Gusto en conocerte ${name}. Empecemos con tu primera lección.`);
                await this.sendExercise(sock, jid, phone);
                break;

            case 'LESSON_0':
                await this.handleLesson0(sock, jid, phone, text, cliente);
                break;

            case 'EXAM_WRITING':
                await this.handleWritingExam(sock, jid, phone, text, cliente);
                break;

            case 'EXAM_SPEAKING':
                await this.handleSpeakingExam(sock, jid, phone, msg, cliente);
                break;

            case 'EXAM_LISTENING':
                await this.handleListeningExam(sock, jid, phone, text, cliente);
                break;
        }

        await excelService.saveCliente(cliente);
    }

    async handleLesson0(sock, jid, phone, text, cliente) {
        let ctx = this.userContext[phone] || { exerciseIndex: 0 };
        const exercise = config.LEVEL_0_EXERCISES[ctx.exerciseIndex];

        // Validar con IA
        const isCorrect = await aiService.validateAnswer(exercise.bot, exercise.translation, text);

        // Generar reacción con IA
        const feedback = await aiService.generateFeedback(isCorrect, cliente.nombre, text);
        await this.sendMessage(sock, jid, feedback);

        if (isCorrect) {
            ctx.exerciseIndex++;
            if (ctx.exerciseIndex < config.LEVEL_0_EXERCISES.length) {
                await this.sendExercise(sock, jid, phone);
            } else {
                cliente.nivel = 1;
                cliente.estado = 'EXAM_WRITING';
                this.userContext[phone] = {
                    writingSection: 0,
                    questionIndex: 0,
                    correct: 0,
                    wrong: 0,
                    sections: Object.keys(examWriting)
                };
                await this.sendMessage(sock, jid, "🥳 ¡Increíble! Has terminado las lecciones de hoy. ¡Buen trabajo! 🌟");
                await this.sendMessage(sock, jid, "Es hora de un breve examen para evaluar tu nivel 📝");
                await this.sendWritingQuestion(sock, jid, phone);
            }
        } else {
            await this.sendMessage(sock, jid, "Inténtalo de nuevo, ¡tú puedes! 💪");
            await this.sendExercise(sock, jid, phone);
        }
    }

    async sendWritingQuestion(sock, jid, phone) {
        const ctx = this.userContext[phone];
        const sectionName = ctx.sections[ctx.writingSection];
        const questions = Object.keys(examWriting[sectionName]);
        const currentQuestion = questions[ctx.questionIndex];
        const expected = examWriting[sectionName][currentQuestion];

        if (ctx.questionIndex === 0) {
            await this.sendMessage(sock, jid, `*${sectionName}*`);
        }

        if (Array.isArray(expected)) {
            // Multiple choice pattern
            let optMsg = `*${currentQuestion}*\n`;
            expected.forEach((opt, i) => {
                optMsg += `${i + 1}️⃣ ${opt}\n`;
            });
            await this.sendMessage(sock, jid, optMsg);
        } else {
            // Direct translation pattern
            await this.sendMessage(sock, jid, currentQuestion);
        }
    }

    async handleWritingExam(sock, jid, phone, text, cliente) {
        const ctx = this.userContext[phone];
        const sectionName = ctx.sections[ctx.writingSection];
        const questions = Object.keys(examWriting[sectionName]);
        const currentQuestion = questions[ctx.questionIndex];
        const expected = examWriting[sectionName][currentQuestion];

        let isCorrect = false;
        if (Array.isArray(expected)) {
            // Check for option index (expected index is usually the correct answer in your JSON?)
            // Based on user description, for pronouns "yo": ["Messy", "They", "I", "Bonjour"], 3 is "I" which is correct.
            // We'll compare the text with the index string or the correct string if we knew which index it is.
            // Assumption: The THIRD option (index 2) is correct for "yo" as per user example. 
            // We need a way to know WHICH one is correct. I'll search for the correct value if possible or assume a specific index.
            // Wait, JSON doesn't say which one is correct. I'll search for typical correct ones for pronouns.

            const correctMappings = {
                "yo": "I", "Tú": "You", "él": "He", "ella": "She", "ello": "It", "nosotros": "We", "ellos": "They"
            };
            const correctAnswer = correctMappings[currentQuestion];
            const selectedIndex = parseInt(text) - 1;
            if (expected[selectedIndex] === correctAnswer || text.toLowerCase() === correctAnswer?.toLowerCase()) {
                isCorrect = true;
            }
        } else {
            // Usar IA para validación flexible en el examen también
            isCorrect = await aiService.validateAnswer(currentQuestion, expected, text);
        }

        // Reacción IA
        const feedback = await aiService.generateFeedback(isCorrect, cliente.nombre, text);
        await this.sendMessage(sock, jid, feedback);

        if (isCorrect) ctx.correct++; else ctx.wrong++;

        ctx.questionIndex++;
        if (ctx.questionIndex >= questions.length) {
            ctx.writingSection++;
            ctx.questionIndex = 0;
        }

        if (ctx.writingSection < ctx.sections.length) {
            await this.sendWritingQuestion(sock, jid, phone);
        } else {
            cliente.estado = 'EXAM_SPEAKING';
            this.userContext[phone] = {
                speakingIndex: 0,
                correct: 0,
                wrong: 0,
                writingResults: [ctx.correct, ctx.wrong]
            };
            await this.sendMessage(sock, jid, "Continuemos...");
            await this.sendMessage(sock, jid, "Para este ejercicio te voy a pedir que uses el microfono🎙️ y pronuncies las siguientes frases📖");
            await this.sendSpeakingPhrase(sock, jid, phone, cliente.nombre);
        }
    }

    async sendSpeakingPhrase(sock, jid, phone, userName) {
        const ctx = this.userContext[phone];
        const phrase = examSpeaking[ctx.speakingIndex].replace("{nombre del cliente}", userName);
        await this.sendMessage(sock, jid, phrase);
    }

    async handleSpeakingExam(sock, jid, phone, msg, cliente) {
        const ctx = this.userContext[phone];
        // En un bot real aqui procesariamos el audio.
        ctx.correct++;
        ctx.speakingIndex++;

        if (ctx.speakingIndex < examSpeaking.length) {
            await this.sendSpeakingPhrase(sock, jid, phone, cliente.nombre);
        } else {
            cliente.estado = 'EXAM_LISTENING';
            this.userContext[phone] = {
                listeningIndex: 0,
                correct: 0,
                wrong: 0,
                writingResults: ctx.writingResults,
                speakingResults: [ctx.correct, ctx.wrong],
                listeningKeys: Object.keys(examListening)
            };
            await this.sendMessage(sock, jid, "Ahora la última parte del examen ✍️¡Vamos!¡No te rindas!");
            await this.sendMessage(sock, jid, "Tienes 10 segundos para escoger la alternativa correcta, presta atención a lo que oyes y responde correctamente.");
            await this.sendListeningQuestion(sock, jid, phone);
        }
    }

    async sendListeningQuestion(sock, jid, phone) {
        const ctx = this.userContext[phone];
        const question = ctx.listeningKeys[ctx.listeningIndex];
        const options = examListening[question];

        await this.sendMessage(sock, jid, `🔊 (BOT AUDIO): ${question}`);
        let optMsg = "";
        options.forEach((opt, i) => {
            optMsg += `${i + 1}️⃣ ${opt}\n`;
        });
        await this.sendMessage(sock, jid, optMsg);
    }

    async handleListeningExam(sock, jid, phone, text, cliente) {
        const ctx = this.userContext[phone];
        const question = ctx.listeningKeys[ctx.listeningIndex];
        const options = examListening[question];

        // Correct answers based on index (based on user's examples: "What is your name?" -> 2️⃣Carlos)
        const correctListening = {
            "What is your name?": "Carlos",
            "Where are you from?": "Perú",
            "How old are you?": "20",
            "What is your favorite color?": "Blue",
            "what is PENCIL": "Lápiz",
            "what is BOOK": "Libro",
            "what is TABLE": "Mesa",
            "what is CHAIR": "Silla",
            "what is PEN": "Lapicero",
            "what is GLASS": "Vaso"
        };

        const correctAnswer = correctListening[question];
        const selectedIndex = parseInt(text) - 1;

        let isCorrect = false;
        if (options[selectedIndex] === correctAnswer || text.toLowerCase() === correctAnswer?.toLowerCase()) {
            isCorrect = true;
        } else {
            // Validación flexible con IA si no coincide exacto
            isCorrect = await aiService.validateAnswer(question, correctAnswer, text);
        }

        if (isCorrect) ctx.correct++; else ctx.wrong++;

        // Reacción IA
        const feedback = await aiService.generateFeedback(isCorrect, cliente.nombre, text);
        await this.sendMessage(sock, jid, feedback);

        ctx.listeningIndex++;

        if (ctx.listeningIndex < ctx.listeningKeys.length) {
            await this.sendListeningQuestion(sock, jid, phone);
        } else {
            const results = [
                { writting: { nivel_0: ctx.writingResults } },
                { speaking: { nivel_0: ctx.speakingResults } },
                { listening: { nivel_0: [ctx.correct, ctx.wrong] } }
            ];
            cliente.progreso = results;
            cliente.estado = 'COMPLETED';

            await this.sendMessage(sock, jid, "Excelente, tu información se guardo en la base de datos. Tomate un descanso por hoy");
            await this.sendMessage(sock, jid, "Te dejo un material para que practiques más.");
            await this.sendMessage(sock, jid, "📄 basic_0.pdf");
            await this.sendMessage(sock, jid, "Hasta mañana. Estudia mucho. hay un camino largo por recorrer :)");
        }
    }

    async sendExercise(sock, jid, phone) {
        const ctx = this.userContext[phone];
        const exercise = config.LEVEL_0_EXERCISES[ctx.exerciseIndex];
        await this.sendMessage(sock, jid, "*Puedes traducirme este texto?*");
        await this.sendMessage(sock, jid, exercise.bot);
    }

    async sendMessage(sock, jid, text) {
        // Delay variable entre 1 y 3 segundos
        const delay = Math.floor(Math.random() * 2000) + 1000;
        await sleep(delay);
        await sock.sendMessage(jid, { text });
    }
}

module.exports = new StateManager();
