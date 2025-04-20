self.addEventListener('install', (event) => {
    console.log('Service Worker installed');
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated');
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'START_RECORDING') {
        // Handle background recording start
        console.log('Background recording started');
    } else if (event.data && event.data.type === 'STOP_RECORDING') {
        // Handle background recording stop
        console.log('Background recording stopped');
    }
}); 