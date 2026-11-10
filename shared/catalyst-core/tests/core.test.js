import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import PrebillApiClient from '../src/PrebillApiClient.js';
import { registerCatalogRoutes } from '../src/catalogs.js';
import { sendError } from '../src/http.js';

const config = { async get() { return { endpoint: 'https://api.example/base/', token: 'SECRETO' }; } };
const httpError = (status, data) => Object.assign(new Error('axios https://api.example/base/x?token=SECRETO'), status ? { response: { status, data } } : {});

test('cliente: token en query, sin doble slash, respuesta JSON', async () => {
    let seen;
    const api = new PrebillApiClient('1', { config, http: { async request(c) { seen = c; return { data: [] }; } } });
    assert.deepEqual(await api.request('get', '/clientes', { params: { a: '1' } }), []);
    assert.equal(seen.url, 'https://api.example/base/clientes');
    assert.deepEqual(seen.params, { a: '1', token: 'SECRETO' });
    assert.equal(seen.headers, undefined);
});

test('cliente: 409 conserva mensaje; 500 se vuelve 502 genérico; red caída en escritura = outcome_unknown', async () => {
    const make = err => new PrebillApiClient('1', { config, http: { async request() { throw err; } } });
    await assert.rejects(make(httpError(409, { error: 'Ya facturado' })).request('patch', '/gastos/1'), e => e.status === 409 && e.message === 'Ya facturado' && !e.outcome_unknown);
    await assert.rejects(make(httpError(500, { error: 'stack interno' })).request('get', '/gastos'), e => e.status === 502 && !/stack/.test(e.message));
    await assert.rejects(make(httpError()).request('post', '/gastos'), e => e.status === 502 && e.outcome_unknown === true && !JSON.stringify(e).includes('SECRETO') && !e.message.includes('SECRETO'));
    await assert.rejects(make(httpError()).request('get', '/gastos'), e => e.outcome_unknown === false);
});

test('cliente: sin conexión configurada responde 503', async () => {
    const api = new PrebillApiClient('1', { config: { async get() { return { endpoint: '', token: '' }; } }, http: {} });
    await assert.rejects(api.request('get', '/clientes'), e => e.status === 503 && e.stage === 'connection');
});

async function serve(catalogs, client) {
    const app = express();
    const calls = [];
    registerCatalogRoutes(app, catalogs, { createClient: org => ({ async request(method, path, opts) { calls.push({ org, method, path, params: opts.params }); return client(); } }) });
    const server = app.listen(0);
    const base = `http://127.0.0.1:${server.address().port}`;
    return { base, calls, close: () => server.close() };
}

test('catálogos: lista blanca, organización numérica y filtros permitidos', async () => {
    const s = await serve({ clientes: [], gastos: ['proyecto_id', 'todos'] }, () => [{ id: 1 }]);
    try {
        let r = await fetch(`${s.base}/636939444/clientes?extra=1`);
        assert.equal(r.status, 200); assert.deepEqual(await r.json(), [{ id: 1 }]);
        assert.deepEqual(s.calls[0], { org: '636939444', method: 'get', path: '/clientes', params: {} });

        r = await fetch(`${s.base}/636939444/gastos?proyecto_id=18&todos&abogado_id=3`);
        assert.deepEqual(s.calls[1].params, { proyecto_id: '18', todos: '' });

        r = await fetch(`${s.base}/636939444/prebills`);
        assert.equal(r.status, 404);
        r = await fetch(`${s.base}/abc/clientes`);
        assert.equal(r.status, 400);
        r = await fetch(`${s.base}/1/gastos?proyecto_id=1%26token%3Dx`);
        assert.equal(r.status, 400);
        assert.equal(s.calls.length, 2);
    } finally { s.close(); }
});

test('catálogos: los errores siguen el contrato { error, stage, outcome_unknown }', async () => {
    const s = await serve({ clientes: [] }, () => { throw Object.assign(new Error('Faltan parámetros de conexión'), { status: 503, stage: 'connection', outcome_unknown: false }); });
    const original = console.error; console.error = () => {};
    try {
        const r = await fetch(`${s.base}/1/clientes`);
        assert.equal(r.status, 503);
        assert.deepEqual(await r.json(), { error: 'Faltan parámetros de conexión', stage: 'connection', outcome_unknown: false });
    } finally { s.close(); console.error = original; }
});

test('sendError oculta el mensaje de un 500', () => {
    const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    const original = console.error; console.error = () => {};
    sendError(res, new Error('TypeError interno'), 'Error interno.');
    console.error = original;
    assert.equal(res.code, 500); assert.equal(res.body.error, 'Error interno.');
});
