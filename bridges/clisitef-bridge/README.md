# clisitef-bridge

Daemon HTTP que carrega a `CliSiTef.dll` da Software Express via FFI
(`koffi`) e a expõe nos endpoints `/transaction`, `/confirm`, `/cancel`,
`/status` esperados pelo `client-local`.

## Sandbox (sem DLL)

```bash
cp .env.example .env
npm install
BRIDGE_MODE=sandbox npm run dev
```

Responde em `http://localhost:8090` com cenários determinísticos
(`.13` recusa, `.99` timeout, demais aprovam).

## Produção (com DLL real)

1. Instale a CliSiTef em `C:\Program Files (x86)\Software Express\`.
2. Em uma máquina **Windows**, rode `npm install koffi`.
3. Configure `.env`:

```env
BRIDGE_MODE=production
CLISITEF_DLL_PATH=C:\Program Files (x86)\Software Express\CliSiTef\CliSiTef32I.dll
```

4. Preencha o laço `Continua/Finaliza` em `src/index.ts` conforme
   o **CliSiTef Manual v3** da Software Express (seções 4.3 e 4.4).

> ⚠️ A SiTef exige homologação na Software Express antes do go‑live em
> produção. O sandbox é para testar somente o lado do totem.
