// PDF.js 6 legacy builds still expect this ES2024 API. Older iOS does not.
if (typeof (Promise as PromiseConstructor & { withResolvers?: unknown }).withResolvers !== 'function') {
  Object.defineProperty(Promise, 'withResolvers', {
    configurable: true, writable: true,
    value: function<T>(this: PromiseConstructor) {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new this<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
      return { promise, resolve, reject };
    }
  });
}
