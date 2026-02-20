const axios = require('axios');
const config = require('./config');

class AIService {
    constructor() {
        this.apiKey = config.DEEPSEEK_API_KEY;
        this.apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    }

    async askAI(prompt, systemPrompt = "Eres Mr.Max, un profesor de inglés entusiasta, amable y muy humano. Usas muchos emojis y hablas de forma cercana.") {
        try {
            const response = await axios.post(this.apiUrl, {
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices[0].message.content.trim();
        } catch (error) {
            console.error(`[AIService] Error calling AI: ${error.message}`);
            return null;
        }
    }

    async validateAnswer(question, expected, actual) {
        const prompt = `
Pregunta: "${question}"
Respuesta esperada (base): "${expected}"
Respuesta del alumno: "${actual}"

¿Es la respuesta del alumno semánticamente correcta y válida para la pregunta? 
Ten en cuenta que en inglés hay sinónimos (ej: "Hi" y "Hello" son válidos para "Hola", "Teacher" es válido para "Profesor/a").
Responde ÚNICAMENTE con la palabra "SÍ" o "NO".`;

        const result = await this.askAI(prompt, "Eres un evaluador de respuestas de inglés estricto pero justo.");
        return result && result.toUpperCase().includes("SÍ");
    }

    async generateFeedback(isCorrect, studentName, studentMessage) {
        const prompt = isCorrect
            ? `El alumno ${studentName} respondió correctamente: "${studentMessage}". Dale un feedback corto, entusiasta y con un emoji de alegría.`
            : `El alumno ${studentName} respondió: "${studentMessage}", pero no es correcto. Dale un feedback corto, motivador, amable y con un emoji de ánimo o tristeza suave. No seas rudo.`;

        return await this.askAI(prompt);
    }
}

module.exports = new AIService();
