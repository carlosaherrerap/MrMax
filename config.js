module.exports = {
    DEEPSEEK_API_KEY: "sk-f2f4b7786835465b8ed234f92fde9980",
    BOT_MESSAGES: {
        PRESENTATION: "😊 *¡Hola!* Soy Mr.Max, tu profesor de inglés personal 🗽🎓. ¡Estoy aquí para que hables inglés como un profesional! 🚀",
        AUTHORIZATION: "Antes de empezar esta aventura *modo PRO* 🎖️, necesito tu autorización 🤳. Si estás listo, escríbeme tu número de WhatsApp actual (ej: 9********) 📲.",
        REJECT: "Si prefieres dejarlo para después 😔, simplemente escribe: *NO. GRACIAS* 👋",
        DECISION: "✨ *¡HAS TOMADO UNA GRAN DECISIÓN!* 👨‍🎓👩‍🎓✨",
        WELCOME: "¡Hola! 👋 Hoy comienza tu camino hacia un futuro bilingüe brillante 🌟. Por favor, pon mucho esfuerzo y cumple con los objetivos diarios. Tendremos de todo: 🗣️ speaking, ✍️ writing, 🎞️ imágenes, 🎧 audios y mucho más. ¡Mr. Max siempre estará a tu lado! 💪🔥",
        NAME_REQUEST: "First things first... *What's your name?* (¿Cómo te llamas?) ✍️😊",
    },
    RESPUESTAS_FEEDBACK: {
        CORRECTO: ["Muy bien, esto es poco para ti😃", "Excelente, no me sorprende que lo hayas hecho bien😊😁"],
        CASI_BIEN: ["Oh wow, empezamos bien😎"],
        ERROR_1: ["Hmm, no precisamente, pero no te desanimen. Apenas empezamos👨🎓"],
        MAL: ["Hey, tranquil@. Todos empezamos así👋"]
    },
    LEVEL_0_EXERCISES: [
        { bot: "Hello, Good morning", translation: "hola buen dia", expected: "good morning" },
        { bot: "Hello, Good afternoon", translation: "hola buenas tardes", expected: "good afternoon" },
        { bot: "Hello, Good evening", translation: "hola buenas noches", expected: "good evening" },
        { bot: "Hello, My favorite color is red", translation: "hola mi color favorito es rojo", expected: "red" },
        { bot: "Hello, My favorite song es *Despacito*", translation: "hola mi cancion favorita es despacito", expected: "despacito" },
        { bot: "Hello, My name is Max", translation: "hola mi nombre es max", expected: "max" },
        { bot: "Hello friend, thank you", translation: "hola amigo gracias", expected: "thank you" }
    ]
};
