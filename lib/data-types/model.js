import DataType from 'stackage-js/data-types/data-type';
import Enum from 'stackage-js/data-types/enum';
import Model from 'stackage-js/data-types/model';
import { isRef, reactive, ref, shallowReactive, shallowRef, triggerRef } from "vue";


const Collection = function(prop, foreignKey){
    const _array = shallowReactive([]);
    
    let type = this.constructor.properties[prop].type;
    if (Array.isArray(type)){
        type = type[0];
    }

    return new Proxy(_array, {
        get: (target, i) => {
            if (i.constructor === Symbol){
                return null;
            }

            if (this._values[foreignKey][i] && Model.CheckKey(this.constructor.properties[foreignKey].type[0], i)){
                return Database[type.name][this._values[foreignKey][i]];
            }

            console.log("getbase");
            return target[i];
        },
        set: (target, i, value) => {
            if (this._values[foreignKey][i] && Model.CheckKey(this.constructor.properties[foreignKey].type[0], i)){
                this[foreignKey][i] = value;
            }

            target[i] = value;
            console.log("setbase", target);
            this._modifier(prop);
            return true;
        }
    });
}

Model.DefineLoaded = function(){
    /**
     * Loaded ref
     */
    const loaded = ref(false);
    Object.defineProperty(this, '_loaded', {
        enumerable: false,
        configurable: false,
        get: () => {
            return loaded;
        }, 
        set: (value) => {
            loaded.value = value;
            //trigger vue reactivity on table ref 
            triggerRef(this._table._ref)
        }
    });
}

/**
 * Sets up additional functionality for Vue in the base Table class
 */
function VueOnCreate(){

}

Model.AddProperty = function (prop, propInfo){
    //prop already exists
    if (Object.hasOwnProperty.call(this, prop)){
        return;
    }

    let type = propInfo.type;
    let enumerable = false;

    if (Array.isArray(type)){
        type = type[0];
        enumerable = true;
    } else {    
        this._values[prop] = ref(null)
    }

    //This property navigates to another model or models
    if (type.prototype instanceof Model){
        if (enumerable){
            //a collection of foreign models

            Object.defineProperty(this, prop, {
                enumerable: true,
                configurable: true,
                get: () => {
                    return this._values[prop];
                },
                set: (value) => {
                    //we're careful here to modify the array from Collection
                    //replacing the array would break reactivity

                    if (value === null){
                        this._values[prop].length = 0;
                    } else if (Array.isArray(value)){
                        this._values[prop].length = 0;
                        this._values[prop].push(...value);
                    }
                    this._modifier(prop);
                },
            });

            //ensure the model collection gets updated when the fk array does
            let foreignKey = Model.GetForeignKey.call(this, prop);
            Model.AddProperty.call(this, foreignKey, this.constructor.properties[foreignKey]);

            //sets up this proxy collection of pointers
            //needs the foreignKey
            this._values[prop] = Collection.call(this, prop, foreignKey);

        } else {
            let foreignKey = Model.GetForeignKey.call(this, prop);

            //single foreign model
            Object.defineProperty(this, prop, {
                enumerable: true,
                get: () => {
                    return Database[type.name][this[foreignKey]].value;
                },
                set: (value) => {
                    if (
                        value === null 
                        || value === undefined 
                        || _checkKey(propInfo.type.properties.id.type, value)
                        ){
                        this._values[foreignKey].value = value;
                        this._modifier(prop);
                    }
                },
            });

            _addProp.call(this, foreignKey, this.constructor.properties[foreignKey]);
        }
    } else if (type instanceof Enum) {
        
        //we don't create an instance of the Enum, it's just a key-value pair we reference 
        if (enumerable){
            Object.defineProperty(this, prop, {
                enumerable: true,
                get: () => {
                    if (this._values[prop].value === null) {
                        return this._values[prop].value;
                    }
                    //map the int values to their enum string equivalents
                    return this._values[prop].value.map(x => type[x]);
                },
                set: (value) => {
                    this._values[prop].value = value;                        
                    this._modifier(prop);
                }
            });
        } else {
            Object.defineProperty(this, prop, {
                enumerable: true,
                get: () => {
                    //map the int value to its enum string equivalent
                    return type[this._values[prop].value];
                },
                set: (value) => {
                    this._values[prop].value = value;
                    this._modifier(prop);
                }
            });
        }
    } else if (type === Date) {
        Object.defineProperty(this, prop, {
            enumerable: true,
            get: () => {
                return this._values[prop].value;
            },
            set: (value) => {
                if (value === null || value instanceof Date){
                    this._values[prop].value = value;
                } else {
                    this._values[prop].value = new Date(value);
                }
                this._modifier(prop);
            }
        });

    } else if (enumerable) {
        this._values[prop] = [];
        Object.defineProperty(this, prop, {
            enumerable: true,
            get: () => {
                return this._values[prop];
            },
            set: (value) => {
                this._values[prop] = value;
                this._modifier(prop);
            }
        });

    } else {
        //custom data type, create an instance
        if (type.baseType === DataType){
            this._values[prop] = new type(null, this.constructor.properties[prop].config);
        }
        //everything remaining just works with regular assignments
        Object.defineProperty(this, prop, {
            enumerable: true,
            get: () => {
                return this._values[prop].value;
            },
            set: (value) => {
                this._values[prop].value = value;
                this._modifier(prop);
            }
        });
    }
}

Model.ModifierCallback = function(prop){
    console.log(prop, this[prop])
}

Model.OnCreate.push(VueOnCreate)
