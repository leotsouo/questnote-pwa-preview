/** MessageChannel replies keep an update request tied to one exact worker. */
export function askWorker(worker, type, payload = {}, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (error, value) => {
      clearTimeout(timer);
      channel.port1.close();
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('更新回應逾時，請稍後重試。')), timeoutMs);
    channel.port1.onmessage = (event) => finish(null, event.data);
    try { worker.postMessage({ type, ...payload }, [channel.port2]); }
    catch (error) { finish(error); }
  });
}
