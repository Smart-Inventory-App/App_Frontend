const fs = require('fs');

// Envoltorio de app.json que agrega las credenciales de Firebase (FCM) en Android.
// Sin google-services.json el APK no puede obtener el token push del dispositivo.
//
// - En EAS el archivo llega como variable de entorno de tipo "file" (GOOGLE_SERVICES_JSON),
//   cuyo valor es la ruta del archivo ya descargado.
// - En local se usa ./google-services.json (ignorado por git).
// Si no hay ninguno de los dos, el build sigue funcionando pero sin notificaciones push.
const LOCAL_GOOGLE_SERVICES_FILE = './google-services.json';

module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ||
    (fs.existsSync(LOCAL_GOOGLE_SERVICES_FILE) ? LOCAL_GOOGLE_SERVICES_FILE : undefined);

  if (!googleServicesFile) {
    return config;
  }

  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile,
    },
  };
};
