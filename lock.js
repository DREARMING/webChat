const UNLOCKED = 0;
const LOCKED_NO_WAITERS = 1;
const LOCKED_POSSIBLE_WAITERS = 2;

// Number of shared Int32 locations needed by the lock.
const NUMINTS = 1;

class Lock {

    constructor() {
        // OMITTED: check parameters
        var shareArrayBuffer = new SharedArrayBuffer(32);
        this.iab = new Int32Array(shareArrayBuffer);
        this.ibase = 0;
    }

    getLockState(){
        const iab = this.iab;
        const stateIdx = this.ibase;
        return Atomics.load(iab, stateIdx);
    }

    /**
     * Acquire the lock, or block until we can. Locking is not recursive:
     * you must not hold the lock when calling this.
     */
    lock() {
        const iab = this.iab;
        const stateIdx = this.ibase;
        var c;
        if ((c = Atomics.compareExchange(iab, stateIdx, // (A)
            UNLOCKED, LOCKED_NO_WAITERS)) !== UNLOCKED) {
            do {
                if (c === LOCKED_POSSIBLE_WAITERS // (B)
                    || Atomics.compareExchange(iab, stateIdx,
                        LOCKED_NO_WAITERS, LOCKED_POSSIBLE_WAITERS) !== UNLOCKED) {
                    Atomics.wait(iab, stateIdx, // (C)
                        LOCKED_POSSIBLE_WAITERS, Number.POSITIVE_INFINITY);
                }
            } while ((c = Atomics.compareExchange(iab, stateIdx,
                UNLOCKED, LOCKED_POSSIBLE_WAITERS)) !== UNLOCKED);
        }
    }

    /**
     * Unlock a lock that is held.  Anyone can unlock a lock that
     * is held; nobody can unlock a lock that is not held.
     */
    unlock() {
        const iab = this.iab;
        const stateIdx = this.ibase;
        var v0 = Atomics.sub(iab, stateIdx, 1); // A
        // Wake up a waiter if there are any
        if (v0 !== LOCKED_NO_WAITERS) {
            Atomics.store(iab, stateIdx, UNLOCKED);
            Atomics.wake(iab, stateIdx, 1);
        }
    }
}

module.exports = new Lock();