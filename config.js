module.exports = {
    BOT_MESSAGES: {
        PRESENTATION: "😊*Hola* Soy Mr.Max Tu bot profesor de inglés🗽.",
        AUTHORIZATION: "Necesito tu autorización🤳 para poder continuar con el *modo PRO*🎖️.  Si *aceptas* escríbeme tu numero actual de whatsapp(9********)",
        REJECT: "Si no😔, solo escribe: *NO. GRACIAS* ",
        DECISION: "*HAS TOMADO UNA GRAN DECISION!👩🎓👨🎓*",
        WELCOME: "Hola 👋, hoy y ahora empieza tu camino hacia un gran futuro bilingue. Por favor, pon mucho esfuerzo y cumple con los objetivos diarios, se te dará mucho ejercicios: 🗣️speaking, ✍️writting,🎞️imagenes,📹videos,🎧audios,etc. Siempre estaremos de tu lado! ",
        NAME_REQUEST: "What's your name(Como te llamas)?",
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
