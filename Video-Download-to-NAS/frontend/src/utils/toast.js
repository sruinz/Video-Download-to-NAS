import toast from 'react-hot-toast';

const toastConfig = {
  duration: 4000,
  position: 'top-right',
  style: {
    background: '#1f1f1f',
    color: '#fff',
    borderRadius: '8px',
    padding: '12px 16px',
  },
};

export const showToast = {
  success: (message) => {
    toast.success(message, {
      ...toastConfig,
      iconTheme: {
        primary: '#10b981',
        secondary: '#fff',
      },
    });
  },

  error: (message) => {
    toast.error(message, {
      ...toastConfig,
      iconTheme: {
        primary: '#ef4444',
        secondary: '#fff',
      },
    });
  },

  loading: (message) => {
    return toast.loading(message, toastConfig);
  },

  promise: (promise, messages) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading || 'Loading...',
        success: messages.success || 'Success!',
        error: messages.error || 'Error occurred',
      },
      toastConfig
    );
  },

  dismiss: (toastId) => {
    toast.dismiss(toastId);
  },
};

export default showToast;
