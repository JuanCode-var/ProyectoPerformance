import axios from 'axios';

export async function analyzeWithObservatory(url: string) {
  // Extraer solo el host de la URL
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    // Si ya es un host, úsalo tal cual
    host = url;
  }
  // Llama a la API de Mozilla HTTP Observatory
  const apiUrl = `https://http-observatory.security.mozilla.org/api/v1/analyze?host=${encodeURIComponent(host)}`;
  try {
    const res = await axios.get(apiUrl);
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      // Devuelve el error real de Mozilla
      return err.response.data;
    }
    throw err;
  }
}
