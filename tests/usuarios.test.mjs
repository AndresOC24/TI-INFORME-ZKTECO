import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseUsuarios, estudiantesDesdeUsuarios } from '../src/scripts/parse.js';
import { parseDocentes, docentesDesdeUsuarios, linkDocentes, aggregateDocentes } from '../src/scripts/docentes-data.js';
function users() {
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
 ['ID','Nombre','Apellido','Documento / Cédula','Nombre de Departamento','Celular','Email'],
 ['1','Ana','Perez','123','DOCENTE','777','ana@example.test'],
 ['2','Ana','Perez','456','ESTUDIANTE','',''],
 ['3','Admin','','789','ADMINISTRATIVOS','',''],
 ['4','Docente','Sin eventos','','DOCENTE','',''],
 ['5','Visita','','','VISITA','',''], ['6','Posgrado','','','POSTGRADO','',''],
 ['7','General','','','General','',''],
 ]),'Usuarios');
 return parseUsuarios(wb);
}
const raw={events:[{id:'1',department:'ESTUDIANTE',dir:'E',day:'2026-11-03',time:'08:00'},
 {id:'2',department:'DOCENTE',dir:'S',day:'2026-11-03',time:'09:00'},
 {id:'3',department:'DOCENTE',dir:'E',day:'2026-11-03',time:'08:00'}],
 names:new Map([['1',{nombre:'Ana',apellido:'Perez'}],['2',{nombre:'Ana',apellido:'Perez'}],['3',{nombre:'Admin',apellido:''}]]),careerById:new Map()};
function directory(rows) {
 const wb = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
 ['Docente', 'CI', 'Carrera', 'Telefono'], ...rows,
 ]), 'Docentes');
 return parseDocentes(wb);
}
test('el Excel define el total e incluye docentes que no figuran en ZKTeco', () => {
 const u = users();
 const excel = directory([['Ana Perez','123','SIS','888'], ['Nuevo Docente','999','MED','']]);
 const r = docentesDesdeUsuarios(u, excel);
 assert.equal(r.total, 2);
 assert.equal(r.byId.has('4'), false);
 assert.equal(r.byId.has('2'), false);
 assert.equal(r.byId.get('1').telefono, '888');
 const rows = aggregateDocentes(raw, r, linkDocentes(raw,r,u));
 assert.equal(rows.length, 2);
 assert.equal(rows.find(r => r.ci === '123').entradas, 1);
 assert.equal(rows.find(r => r.ci === '999').entradas, 0);
 assert.deepEqual([...rows.find(r => r.ci === '123').ids], ['1']);
 assert.deepEqual(estudiantesDesdeUsuarios(raw,u).events.map(e=>e.id),['2']);
});
test('varias carreras e IDs no inflan el total y reemplazar el Excel elimina antiguos', () => {
 const u = users();
 u.byId.set('8', {...u.byId.get('1'), rol: 'General'});
 const excel = directory([['Ana Perez','123','SIS',''], ['Ana Perez','123','MED','']]);
 const r = docentesDesdeUsuarios(u, excel);
 assert.equal(r.total, 1);
 assert.deepEqual(r.teachers[0].carreras, ['SIS', 'MED']);
 assert.deepEqual(r.teachers[0].zktecoIds, ['1','8']);
 const replacement = docentesDesdeUsuarios(u, directory([['Nuevo Docente','999','MED','']]));
 const rows = aggregateDocentes(raw, replacement, linkDocentes(raw,replacement,u));
 assert.equal(rows.length, 1);
 assert.equal(rows[0].ci, '999');
 assert.equal(rows[0].entradas, 0);
});
test('sin Excel no presenta el padron como directorio actualizado', () => {
 assert.equal(docentesDesdeUsuarios(users(), null), null);
 assert.deepEqual(aggregateDocentes(raw, null, linkDocentes(raw,null,users())), []);
});
test('sin padron conserva el filtro por departamento del evento',()=>{
 assert.deepEqual(estudiantesDesdeUsuarios(raw,null).events.map(e=>e.id),['1']);
});
