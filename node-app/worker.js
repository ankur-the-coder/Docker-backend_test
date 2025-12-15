const { parentPort } = require('worker_threads');

function isPrime(num) {
    for (let i = 2, s = Math.sqrt(num); i <= s; i++) {
        if (num % i === 0) return false;
    }
    return num > 1;
}

function compute() {
    let count = 0, num = 2;
    while (count < 10000) {
        if (isPrime(num)) count++;
        num++;
    }
    return num - 1;
}

parentPort.on('message', () => {
    parentPort.postMessage(compute());
});
