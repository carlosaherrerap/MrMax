const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

class ExcelService {
    constructor() {
        this.filePath = path.join(__dirname, 'clientes.xlsx');
    }

    async init() {
        if (!fs.existsSync(this.filePath)) {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Clientes');
            sheet.columns = [
                { header: 'key', key: 'key' },
                { header: 'value', key: 'value' },
                { header: 'nombre', key: 'nombre' },
                { header: 'nivel', key: 'nivel' },
                { header: 'estado', key: 'estado' },
                { header: 'progreso', key: 'progreso' }
            ];
            await workbook.xlsx.writeFile(this.filePath);
        }
    }

    async getCliente(phoneNumber) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(this.filePath);
        const sheet = workbook.getWorksheet('Clientes');

        let cliente = null;
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            if (row.getCell('key').value === phoneNumber) {
                cliente = {
                    key: row.getCell('key').value,
                    value: row.getCell('value').value,
                    nombre: row.getCell('nombre').value,
                    nivel: row.getCell('nivel').value || 0,
                    estado: row.getCell('estado').value || 'START',
                    progreso: row.getCell('progreso').value ? JSON.parse(row.getCell('progreso').value) : []
                };
            }
        });
        return cliente;
    }

    async saveCliente(cliente) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(this.filePath);
        const sheet = workbook.getWorksheet('Clientes');

        let found = false;
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            if (row.getCell('key').value === cliente.key) {
                row.getCell('value').value = cliente.value;
                row.getCell('nombre').value = cliente.nombre;
                row.getCell('nivel').value = cliente.nivel;
                row.getCell('estado').value = cliente.estado;
                row.getCell('progreso').value = JSON.stringify(cliente.progreso);
                found = true;
            }
        });

        if (!found) {
            sheet.addRow({
                key: cliente.key,
                value: cliente.value,
                nombre: cliente.nombre,
                nivel: cliente.nivel,
                estado: cliente.estado || 'START',
                progreso: JSON.stringify(cliente.progreso || [])
            });
        }

        await workbook.xlsx.writeFile(this.filePath);
    }
}

module.exports = new ExcelService();
