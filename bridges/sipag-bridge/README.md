# sipag-bridge

Daemon HTTP para o **SDK Sipag Integrado** (Sicredi/Senff). O SDK oficial é um
JAR Java; esta bridge o controla via subprocesso e expõe o contrato REST
esperado pelo `client-local`.

## Sandbox

```bash
cp .env.example .env
npm install
BRIDGE_MODE=sandbox npm run dev
```

## Produção

1. Solicitar o JAR `sipag-integrado-x.y.z.jar` ao gerente Sicredi.
2. Instalar Java 11+ na máquina.
3. Configurar `.env`:

```env
BRIDGE_MODE=production
SIPAG_JAR_PATH=C:\Sipag\sipag-integrado.jar
SIPAG_MERCHANT_KEY=<chave_credenciamento>
```

4. Implementar o spawn em `src/index.ts` (bloco `productionTx`) — o protocolo
   é documentado no **Manual de Integração Sipag PDV** entregue pela Sicredi
   junto com as credenciais.
