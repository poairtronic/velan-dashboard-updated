import LogRocket from 'logrocket';

export const initLogRocket = () => {
  if (import.meta.env.PROD && import.meta.env.VITE_LOGROCKET_ID) {
    LogRocket.init(import.meta.env.VITE_LOGROCKET_ID, {
      network: {
        requestSanitizer: (request) => {
          if (request.headers['Authorization'] || request.headers['authorization']) {
            request.headers['Authorization'] = 'Hidden';
          }
          return request;
        },
      },
      dom: {
        inputSanitizer: true, // Prevent sensitive input logging like passwords
      }
    });
  }
};
