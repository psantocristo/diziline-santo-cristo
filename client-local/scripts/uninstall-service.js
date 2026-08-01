const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'DízimoSC Client',
  description: 'Módulo local para integração com impressora térmica e PINPad',
  script: path.resolve(__dirname, '../dist/index.js'),
  nodeOptions: [],
  env: [{
    name: 'NODE_ENV',
    value: 'production',
  }],
});

svc.on('uninstall', () => {
  console.log('Serviço removido com sucesso!');
});

svc.on('error', (err) => {
  console.error('Erro:', err);
});

svc.uninstall();
