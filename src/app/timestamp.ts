let lastTimestamp = 0;
export function makeAdvancingTimestamp() {
    const us = performance.now() * 1000;
    const time = Math.floor(us);

    if(time > lastTimestamp) {
        lastTimestamp = time;
        return time;
    } else {
        lastTimestamp++;
        return lastTimestamp;
    }
}