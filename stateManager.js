const config = require('./config');
const excelService = require('./excelService');
const fs = require('fs');
const path = require('path');

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
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        let cliente = await excelService.getCliente(phone);

        if (!cliente) {
            await this.sendMessage(sock, jid, config.BOT_MESSAGES.PRESENTATION);
            await this.sendMessage(sock, jid, config.BOT_MESSAGES.AUTHORIZATION);
            await this.sendMessage(sock, jid, config.BOT_MESSAGES.REJECT);

            await excelService.saveCliente({
                key: phone,
                value: "",
                nombre: "",
                nivel: 0,
                estado: 'WAITING_AUTH'
            });
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
            await this.sendMessage(sock, jid, "Has terminado las lecciones de hoy. ¡Buen trabajo!");
            await this.sendMessage(sock, jid, "Es hora de un breve examen para evaluar tu nivel");
            await this.sendWritingQuestion(sock, jid, phone);
        }
    }

    async sendWritingQuestion(sock, jid, phone) {
        const ctx = this.userContext[phone];
        const sectionName = ctx.sections[ctx.writingSection];
        const questions = Object.keys(examWriting[sectionName]);
        const currentQuestion = questions[ctx.questionIndex];

        if (ctx.questionIndex === 0) {
            await this.sendMessage(sock, jid, `*${sectionName}*`);
        }

        await this.sendMessage(sock, jid, currentQuestion);
    }

    async handleWritingExam(sock, jid, phone, text, cliente) {
        const ctx = this.userContext[phone];
        const sectionName = ctx.sections[ctx.writingSection];
        const questions = Object.keys(examWriting[sectionName]);
        const currentQuestion = questions[ctx.questionIndex];
        const expected = examWriting[sectionName][currentQuestion];

        // Simple validation
        const isCorrect = Array.isArray(expected) ? expected.includes(text) : text.toLowerCase() === expected.toLowerCase();

        if (isCorrect) ctx.correct++; else ctx.wrong++;

        ctx.questionIndex++;
        if (ctx.questionIndex >= questions.length) {
            ctx.writingSection++;
            ctx.questionIndex = 0;
        }

        if (ctx.writingSection < ctx.sections.length) {
            await this.sendWritingQuestion(sock, jid, phone);
        } else {
            // Fin Writing
            cliente.estado = 'EXAM_SPEAKING';
            this.userContext[phone] = {
                speakingIndex: 0,
                correct: ctx.correct,
                wrong: ctx.wrong,
                writingResults: [ctx.correct, ctx.wrong]
            };
            await this.sendMessage(sock, jid, "Continuemos...");
            await this.sendMessage(sock, jid, "Para este ejercicio te voy a pedir que uses el microfono🎙️ y pronuncies las siguientes frases📖");
            await this.sendSpeakingPhrase(sock, jid, phone);
        }
    }

    async sendSpeakingPhrase(sock, jid, phone) {
        const ctx = this.userContext[phone];
        const phrase = examSpeaking[ctx.speakingIndex].replace("{nombre del cliente}", "Luis"); // Hardcoded Luis for now or use cliente.nombre
        await this.sendMessage(sock, jid, phrase);
    }

    async handleSpeakingExam(sock, jid, phone, msg, cliente) {
        const ctx = this.userContext[phone];
        // En un entorno real aqui usariamos STT. Para este bot asumiremos que el audio es enviado.
        // Simularemos acierto por ahora o solo avanzaremos.
        ctx.correct++; // Simulado
        ctx.speakingIndex++;

        if (ctx.speakingIndex < examSpeaking.length) {
            await this.sendSpeakingPhrase(sock, jid, phone);
        } else {
            cliente.estado = 'EXAM_LISTENING';
            this.userContext[phone] = {
                listeningIndex: 0,
                correct: 0,
                wrong: 0,
                writingResults: ctx.writingResults,
                speakingResults: [10, 0], // Simulado 10 buenas
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

        await this.sendMessage(sock, jid, `🔊 (Audio): ${question}`); // Enviar audio real en prod
        let optMsg = "";
        options.forEach((opt, i) => {
            optMsg += `${i + 1}️⃣${opt}\n`;
        });
        await this.sendMessage(sock, jid, optMsg);

        // Timer simulado: en un bot real usariamos un setTimeout para forzar el avance
    }

    async handleListeningExam(sock, jid, phone, text, cliente) {
        const ctx = this.userContext[phone];
        ctx.listeningIndex++;

        if (ctx.listeningIndex < ctx.listeningKeys.length) {
            await this.sendListeningQuestion(sock, jid, phone);
        } else {
            // FIN DE TODO
            const finalResults = {
                writting: { nivel_0: ctx.writingResults },
                speaking: { nivel_0: ctx.speakingResults },
                listening: { nivel_0: [8, 2] } // Simulado
            };
            cliente.progreso.push(finalResults);
            cliente.estado = 'COMPLETED';

            await this.sendMessage(sock, jid, "Excelente, tu información se guardo en la base de datos. Tomate un descanso por hoy");
            await this.sendMessage(sock, jid, "Te dejo un material para que practiques más.");
            // Enviar PDF (simulado)
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
        await sock.sendMessage(jid, { text });
    }
}

module.exports = new StateManager();
