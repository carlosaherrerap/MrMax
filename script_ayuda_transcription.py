import os
import speech_recognition as sr
from tqdm import tqdm
import time
import shutil
from pydub import AudioSegment

# Configuración
INPUT_FOLDER = "E:/ProcesoAudios/2026/doyouanalitics_30"  # <----MODIFICA ESTA RUTA
PARENT_DIR = os.path.dirname(INPUT_FOLDER)
FOLDER_NAME = os.path.basename(INPUT_FOLDER)
OUTPUT_FOLDER = os.path.join(PARENT_DIR, f"speechToText_{FOLDER_NAME}")
TEMP_DIR = os.path.join(PARENT_DIR, "temp_audio_chunks")

# Formatos soportados
SUPPORTED_FORMATS = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}

# Parámetros de segmentación (Google tiene límite de ~1 minuto por petición)
CHUNK_DURATION_SEC = 50  # Chunks de 50 segundos para evitar límite de Google

print(f"🚀 Iniciando transcripción con Google Speech Recognition (GRATIS)")
print(f"📂 Carpeta de entrada: {INPUT_FOLDER}")
print(f"💾 Carpeta de salida: {OUTPUT_FOLDER}")
print(f"🌐 Requiere conexión a internet\n")

def convert_to_wav(file_path):
    """Convierte cualquier audio a WAV (formato requerido por SpeechRecognition)"""
    try:
        audio = AudioSegment.from_file(file_path)
        
        # Crear archivo temporal WAV
        os.makedirs(TEMP_DIR, exist_ok=True)
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        wav_path = os.path.join(TEMP_DIR, f"{base_name}_temp.wav")
        
        # Convertir a WAV mono 16kHz (óptimo para reconocimiento)
        audio = audio.set_channels(1).set_frame_rate(16000)
        audio.export(wav_path, format="wav")
        
        return wav_path
    except Exception as e:
        print(f"⚠️ Error al convertir {file_path}: {e}")
        return None

def segment_audio_for_google(file_path):
    """Segmenta audio en chunks de ~50 segundos (límite de Google API)"""
    try:
        # Convertir a WAV primero
        wav_path = convert_to_wav(file_path)
        if not wav_path:
            return []
        
        audio = AudioSegment.from_wav(wav_path)
        duration_sec = len(audio) / 1000
        
        # Si es corto, devolver el archivo completo
        if duration_sec <= CHUNK_DURATION_SEC:
            return [wav_path]
        
        # Segmentar en chunks
        chunks = []
        chunk_duration_ms = CHUNK_DURATION_SEC * 1000
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        
        for i in range(0, len(audio), chunk_duration_ms):
            chunk = audio[i:i + chunk_duration_ms]
            chunk_path = os.path.join(TEMP_DIR, f"{base_name}_chunk_{i//chunk_duration_ms:04d}.wav")
            chunk.export(chunk_path, format="wav")
            chunks.append(chunk_path)
        
        # Eliminar el WAV temporal completo
        if os.path.exists(wav_path) and len(chunks) > 1:
            os.remove(wav_path)
        
        return chunks
    except Exception as e:
        print(f"⚠️ Error al segmentar {file_path}: {e}")
        return []

def transcribe_audio_google(file_path):
    """Transcribe un archivo usando Google Speech Recognition"""
    recognizer = sr.Recognizer()
    
    try:
        # Segmentar el audio
        chunks = segment_audio_for_google(file_path)
        if not chunks:
            return "❌ Error al procesar el audio"
        
        transcriptions = []
        
        for chunk_path in chunks:
            try:
                with sr.AudioFile(chunk_path) as source:
                    # Ajustar para ruido ambiente
                    recognizer.adjust_for_ambient_noise(source, duration=0.5)
                    audio_data = recognizer.record(source)
                    
                    # Transcribir con Google (gratis, idioma español)
                    text = recognizer.recognize_google(audio_data, language="es-ES")
                    transcriptions.append(text)
                    
            except sr.UnknownValueError:
                # Google no pudo entender el audio
                transcriptions.append("[inaudible]")
            except sr.RequestError as e:
                # Error de conexión con Google
                return f"❌ Error de conexión: {str(e)}"
            except Exception as e:
                transcriptions.append(f"[error: {str(e)}]")
            
            # Limpiar chunk temporal
            try:
                if os.path.exists(chunk_path):
                    os.remove(chunk_path)
            except:
                pass
        
        # Combinar todas las transcripciones
        final_text = " ".join(transcriptions)
        return final_text if final_text.strip() else "❌ No se detectó texto"
        
    except Exception as e:
        return f"❌ ERROR: {str(e)}"

def process_file(file_path):
    """Procesa un solo archivo y guarda la transcripción"""
    filename = os.path.basename(file_path)
    output_path = os.path.join(OUTPUT_FOLDER, os.path.splitext(filename)[0] + ".txt")
    
    # Saltar si ya existe
    if os.path.exists(output_path):
        return f"⏭️ {filename} (ya existe)"
    
    # Transcribir
    transcription = transcribe_audio_google(file_path)
    
    # Determinar ícono de estado
    if transcription.startswith("❌"):
        status_icon = "❌"
    elif "[inaudible]" in transcription:
        status_icon = "⚠️"
    else:
        status_icon = "✅"
    
    # Guardar transcripción
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(transcription)
    
    preview = transcription[:50] + "..." if len(transcription) > 50 else transcription
    return f"{status_icon} {filename}: {preview}"

def main():
    """Función principal"""
    # Crear carpetas
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    os.makedirs(TEMP_DIR, exist_ok=True)
    
    # Listar archivos de audio
    audio_files = [
        os.path.join(INPUT_FOLDER, f)
        for f in os.listdir(INPUT_FOLDER)
        if os.path.splitext(f)[1].lower() in SUPPORTED_FORMATS
    ]
    
    if not audio_files:
        print(f"⚠️ No se encontraron archivos de audio en: {INPUT_FOLDER}")
        print(f"Formatos soportados: {', '.join(SUPPORTED_FORMATS)}")
        return
    
    print(f"📝 Se transcribirán {len(audio_files)} archivos")
    print(f"⚙️ Configuración:")
    print(f"   - API: Google Speech Recognition (gratis)")
    print(f"   - Idioma: Español (es-ES)")
    print(f"   - Chunks: {CHUNK_DURATION_SEC} segundos\n")
    
    start_time = time.time()
    results = []
    
    # Procesar archivos con barra de progreso
    with tqdm(total=len(audio_files), desc="Progreso", unit="archivo") as pbar:
        for file_path in audio_files:
            result = process_file(file_path)
            results.append(result)
            pbar.update(1)
            pbar.set_postfix_str(result.split(":")[0])
    
    # Limpiar directorio temporal
    try:
        if os.path.exists(TEMP_DIR):
            shutil.rmtree(TEMP_DIR)
            print(f"\n🧹 Archivos temporales limpiados")
    except Exception as e:
        print(f"⚠️ Error al limpiar temporales: {e}")
    
    # Reporte final
    elapsed = time.time() - start_time
    success_count = sum(1 for r in results if r.startswith("✅"))
    warning_count = sum(1 for r in results if "⚠️" in r)
    error_count = sum(1 for r in results if "❌" in r)
    
    print(f"\n{'='*60}")
    print(f"✨ PROCESO COMPLETADO EN {elapsed/60:.1f} MINUTOS")
    print(f"✅ Exitosos: {success_count} | ⚠️ Parciales: {warning_count} | ❌ Errores: {error_count}")
    print(f"📁 Resultados en: {OUTPUT_FOLDER}")
    print(f"⚡ Velocidad: {len(audio_files)/elapsed*60:.1f} archivos/min")
    print(f"{'='*60}\n")
    
    # Mostrar ejemplos
    print("📋 Ejemplos de transcripciones:")
    txt_files = sorted([f for f in os.listdir(OUTPUT_FOLDER) if f.endswith('.txt')])
    for txt_file in txt_files[:5]:
        try:
            with open(os.path.join(OUTPUT_FOLDER, txt_file), "r", encoding="utf-8") as f:
                content = f.read()[:60]
                print(f"  • {txt_file}: {content}...")
        except:
            pass

if __name__ == "__main__":
    main()