# stone-bridge — ⚠️ não disponível para PC

A **Stone PoS / Pagar.me Maquininha** **não possui SDK Windows/Linux para PC**.
A integração oficial só roda **embarcada no Android da própria maquininha**
(Stone S920, L400, Linker, Pagar.me Smart, etc.) via Stone PoS SDK (`.aar`).

## O que isso significa para o totem (PC)

- ❌ Não é possível ligar uma maquininha Stone por USB ao totem PC e operá‑la
  como TEF tradicional.
- ✅ Use a **API Pagar.me Cloud v5** (já implementada no
  `supabase/functions/_shared/payment-providers.ts`) — o totem gera PIX ou
  link de cartão e a transação acontece no celular do contribuinte ou via QR.
- ✅ Se você tem uma maquininha Stone física e quer rodar o sistema **nela**,
  o frontend já é responsivo e pode rodar no Chrome embarcado da máquina —
  basta criar um app companion Android que escute o `intent` Stone PoS SDK e
  exponha o mesmo contrato HTTP via `http://localhost:9000` *dentro do
  Android*. Esse companion está **fora do escopo deste repositório**.

## Sandbox utilitário

Para validar o fluxo "Stone" no totem **sem maquininha**, basta deixar o
`client-local` em `TEF_MODE=sandbox` — o simulador interno responde como se
fosse Stone. Não precisa subir nada nesta pasta.

## Roadmap

Quando/se a Stone publicar Stone PoS Cloud REST (já existe em beta restrito
para integradores selecionados), criaremos a bridge equivalente aqui.
