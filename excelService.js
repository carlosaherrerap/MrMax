const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class ExcelService {
    constructor() {
        this.filePath = path.resolve(__dirname, 'clientes.xlsx');
        this.lock = Promise.resolve();
    }

    async init() {
        const workbook = new ExcelJS.Workbook();
        if (!fs.existsSync(this.filePath)) {
            const sheet = workbook.addWorksheet('Clientes');
            this._setColumns(sheet);
            await workbook.xlsx.writeFile(this.filePath);
            console.log(`[ExcelService] Archivo creado: ${this.filePath}`);
        } else {
            try {
                await workbook.xlsx.readFile(this.filePath);
                const sheet = workbook.getWorksheet('Clientes');
                this._ensureIdColumn(sheet, workbook);
            } catch (err) {
                console.error(`[ExcelService] Error inicializando archivo: ${err.message}`);
                // Dejar que el gestor de corrupción en getCliente lo maneje si es necesario
            }
        }
    }

    _setColumns(sheet) {
        sheet.columns = [
            { header: 'key', key: 'key', width: 25 },
            { header: 'id', key: 'id', width: 25 },
            { header: 'value', key: 'value' },
            { header: 'nombre', key: 'nombre' },
            { header: 'nivel', key: 'nivel' },
            { header: 'estado', key: 'estado' },
            { header: 'progreso', key: 'progreso' }
        ];
        sheet.getColumn('key').numFmt = '@';
        sheet.getColumn('id').numFmt = '@';
    }

    async _ensureIdColumn(sheet, workbook) {
        // En ExcelJS, leer un archivo no popula sheet.columns automáticamente.
        // Verificamos la primera fila (encabezados)
        const headerRow = sheet.getRow(1);
        let hasId = false;
        headerRow.eachCell((cell) => {
            if (cell.value === 'id') hasId = true;
        });

        if (!hasId) {
            console.log("[ExcelService] Agregando columna 'id' detectada faltante...");
            // Insertamos la columna B (2) para 'id'
            sheet.spliceColumns(2, 0, []);
            sheet.getRow(1).getCell(2).value = 'id';
            this._setColumns(sheet); // Remapear llaves
            await workbook.xlsx.writeFile(this.filePath);
        } else {
            this._setColumns(sheet); // Asegurar llaves incluso si ya existe
        }
    }

    async getCliente(phoneNumber) {
        return this.lock = this.lock.then(async () => {
            if (!fs.existsSync(this.filePath)) return null;

            const workbook = new ExcelJS.Workbook();
            try {
                await workbook.xlsx.readFile(this.filePath);
            } catch (error) {
                console.error(`[ExcelService] Error leyendo archivo: ${error.message}`);
                // Si el archivo está corrupto (0 bytes), intentamos borrarlo para que init() lo recree
                if (error.message.includes('End of data reached') || error.message.includes('Corrupted zip')) {
                    console.warn(`[ExcelService] Archivo corrupto detectado. Borrando ${this.filePath}`);
                    fs.unlinkSync(this.filePath);
                    await this.init();
                }
                return null;
            }

            const sheet = workbook.getWorksheet('Clientes');
            if (!sheet) return null;
            this._setColumns(sheet); // CRITICO: Asignar columnas para que getCell('key') funcione

            let cliente = null;
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                // Usamos .text para obtener la representación en cadena y evitar notación científica
                const key = row.getCell('key').text.trim();
                const searchKey = String(phoneNumber).trim();

                if (key === searchKey) {
                    cliente = {
                        key: key,
                        id: row.getCell('id').text || "",
                        value: row.getCell('value').value,
                        nombre: row.getCell('nombre').value,
                        nivel: row.getCell('nivel').value || 0,
                        estado: row.getCell('estado').value || 'START',
                        progreso: row.getCell('progreso').value ? JSON.parse(String(row.getCell('progreso').value)) : []
                    };
                }
            });
            console.log(`[ExcelService] getCliente(${phoneNumber}) -> ${cliente ? 'Encontrado: ' + cliente.estado : 'No encontrado'}`);
            return cliente;
        }).catch(err => {
            console.error(`[ExcelService] Error en getCliente: ${err.message}`);
            return null;
        });
    }

    async saveCliente(cliente) {
        return this.lock = this.lock.then(async () => {
            if (!fs.existsSync(this.filePath)) await this.init();

            const workbook = new ExcelJS.Workbook();
            try {
                await workbook.xlsx.readFile(this.filePath);
            } catch (error) {
                console.error(`[ExcelService] Error leyendo archivo en save: ${error.message}`);
                if (error.message.includes('End of data reached') || error.message.includes('Corrupted zip')) {
                    fs.unlinkSync(this.filePath);
                    await this.init();
                    await workbook.xlsx.readFile(this.filePath);
                } else {
                    throw error;
                }
            }

            const sheet = workbook.getWorksheet('Clientes');
            this._setColumns(sheet); // CRITICO: Asignar columnas para que getCell('key') funcione

            let found = false;
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                if (row.getCell('key').text.trim() === String(cliente.key).trim()) {
                    row.getCell('id').value = String(cliente.id || "");
                    row.getCell('value').value = cliente.value;
                    row.getCell('nombre').value = cliente.nombre;
                    row.getCell('nivel').value = cliente.nivel;
                    row.getCell('estado').value = cliente.estado;
                    row.getCell('progreso').value = JSON.stringify(cliente.progreso || []);
                    // Forzar formato de texto
                    row.getCell('key').numFmt = '@';
                    row.getCell('id').numFmt = '@';
                    found = true;
                }
            });

            if (!found) {
                const newRow = sheet.addRow({
                    key: String(cliente.key),
                    id: String(cliente.id || ""),
                    value: cliente.value,
                    nombre: cliente.nombre,
                    nivel: cliente.nivel,
                    estado: cliente.estado || 'START',
                    progreso: JSON.stringify(cliente.progreso || [])
                });
                newRow.getCell('key').numFmt = '@';
                newRow.getCell('id').numFmt = '@';
            }

            await workbook.xlsx.writeFile(this.filePath);
            console.log(`[ExcelService] saveCliente(${cliente.key}) -> Estado: ${cliente.estado}`);
        }).catch(err => {
            console.error(`[ExcelService] Error en saveCliente: ${err.message}`);
        });
    }
}

module.exports = new ExcelService();
