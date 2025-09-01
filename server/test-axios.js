// test-axios.js
// Script para probar la conexión entre el backend principal y el microservicio PageSpeed

import axios from 'axios';

// Usa la variable de entorno o el valor por defecto del backend
const MS_PAGESPEED_URL = process.env.MS_PAGESPEED_URL || 'http://localhost:3001';
const endpoint = MS_PAGESPEED_URL.replace(/\/+$/, '') + '/audit';

// Cambia esta URL por una real que quieras auditar
debugger;
const testPayload = {
  url: 'https://www.example.com',
  strategy: 'mobile',
  categories: ['performance', 'accessibility', 'best-practices', 'seo']
};

console.log('Probando POST a:', endpoint);
console.log('Payload:', testPayload);

axios.post(endpoint, testPayload, { timeout: 60000 })
  .then(res => {
    console.log('✅ Respuesta recibida del microservicio:');
    console.dir(res.data, { depth: 4 });
  })
  .catch(err => {
    if (err.response) {
      console.error('❌ Error de respuesta:', err.response.status, err.response.data);
    } else if (err.request) {
      console.error('❌ No hubo respuesta del microservicio:', err.message);
    } else {
      console.error('❌ Error al hacer la petición:', err.message);
    }
    process.exit(1);
  });
