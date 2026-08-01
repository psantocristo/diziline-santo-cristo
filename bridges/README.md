# 🔌 Bridges TEF nativas — DízimoSC

Cada provedor de maquininha exige um **daemon HTTP local** que traduza requisições
REST (`POST /transaction`, `/confirm`, `/cancel`, `GET /status`) para o SDK
nativo do fabricante. Este diretório reúne esqueletos prontos para cada um.

| Provedor | Pasta | Tecnologia base | Porta padrão | Status do skeleton |
|----------|-------|-----------------|--------------|--------------------|
| **Connect TEF / SiTef (Rede)** | `clisitef-bridge/` | Node + FFI (`koffi`) → `CliSiTef.dll` | `8090` | ✅ Sandbox funcional + slots FFI marcados `// TODO real` |
| **Sipag Integrado (Sicredi)** | `sipag-bridge/` | Java (SDK Sipag) + Node front HTTP | `60906` | ✅ Sandbox funcional + README com setup do JAR oficial |
| **Stone PoS / Pagar.me Maquininha** | `stone-bridge/` | Android nativo embarcado | `9000` (relay) | ⚠️ Não roda em PC. Doc explica usar Pagar.me Cloud v5 |
| **PayGo PGWebLib** | `paygo-bridge/` | Node + WebSocket (PGWebLib Web SDK) | `9999` | ✅ Sandbox funcional + cliente WS pronto |

Todos os daemons aceitam `BRIDGE_MODE=sandbox` para subir e responder
contratualmente sem o SDK real instalado — você consegue rodar os testes
end‑to‑end do totem hoje, em qualquer máquina, mesmo sem maquininha.

## Como usar

```bash
cd bridges/clisitef-bridge   # ou sipag-bridge / paygo-bridge
cp .env.example .env
npm install
BRIDGE_MODE=sandbox npm run dev   # responde aos contratos sem hardware
# ou
BRIDGE_MODE=production npm run dev   # exige SDK / DLL real instalada
```

No client local (`client-local/.env`), aponte a URL do provedor escolhido
para o daemon (`TEF_MIDDLEWARE_URL=http://localhost:8090` etc.) e mantenha
`TEF_MODE=producao`. Para validar o pipeline sem nenhum daemon, use
`TEF_MODE=sandbox` direto no client local — o simulador interno responde.

## Contrato HTTP padrão (todas as bridges)

```
GET  /status                     → { ok, firmware, serial }
POST /transaction { action: 'credit'|'debit', amount, installments, terminalId, reference }
                                 → { approved, nsu?, authCode?, brand?, returnCode?, message? }
POST /confirm     { nsu, terminalId }   → 200 OK
POST /cancel      { nsu?, terminalId }  → 200 OK
```

## Cenários do sandbox

Todos as bridges em `BRIDGE_MODE=sandbox` seguem o mesmo padrão determinístico:

| Final do valor (centavos) | Resposta |
|---------------------------|----------|
| `.13` | RECUSADA (returnCode `51` — saldo insuficiente) |
| `.99` | TIMEOUT |
| qualquer outro | APROVADA após ~2s |
