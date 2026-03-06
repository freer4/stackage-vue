import { Database, Table } from 'stackage-js';
import { isReactive, reactive, shallowReactive, shallowRef, triggerRef } from 'vue';

// DEV NOTE //
// I tried all sorts of solutions in an attempt to make the table object reactive.
// Ultimately, the issue is that the act of making it reactive in any way requires peaking
// at the records, which triggers record loading, which destroys lazy-loading. 

/**
 * Defines _keys property, a read-only reactive array of the known keys of this table.
 * Behind proxy
 */
Table.DefineKeys = function(){
    Object.defineProperty(this.table, '_keys', {
        enumerable: false,
        writable: false,
        value: reactive([]),
    });
}

const baseDiscover = Table.Discover;
/**
 * Triggers reactivity on the _ref property when discover completes
 * @returns promise from the base version of discover
 */
Table.Discover = function(){
    return baseDiscover.call(this).then((response) => {
        this.table = this.table;
        triggerRef(this.table._ref)
        return response;
    })
}

/**
 * Sets up additional functionality for Vue in the base Table class
 */
function VueOnCreate(){

    const reactiveTable = shallowRef(this.table)
    /**
     * Defines _reacitve property, a read-only reference to a shallowRef version of this table.
     */
    Object.defineProperty(this.table, '_ref', {
        enumerable: false,
        configurable: false,
        get: () => {
            return reactiveTable;
        }
    })
}

Table.OnCreate.push(VueOnCreate)
