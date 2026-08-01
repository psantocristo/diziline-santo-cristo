# paygo-bridge

Daemon HTTP para PayGo PGWebLib (Setis). Traduz REST → WebSocket do
PGWebLib Web SDK.

## Sandbox

```bash
cp .env.example .env
npm install
BRIDGE_MODE=sandbox npm run dev
```

## Produção

1. Instalar **PGWebLib** no Windows (instalador oficial Setis).
2. Confirmar que o serviço escuta em `ws://localhost:60906`.
3. `.env`:

```env
BRIDGE_MODE=production
PGWEBLIB_WS_URL=ws://localhost:60906
```

4. Implementar `productionTx` em `src/index.ts` seguindo o **Manual PGWebLib**
   (operações VDC = venda crédito, VDD = venda débito).
