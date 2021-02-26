const neo4j = require('neo4j-driver'); // Docs: https://neo4j.com/docs/api/javascript-driver/4.2/

/**
 * @class
 */
class Database {
  /**
   * @param {Object} conf A configuration object.
   * @param {String} conf.host
   * @param {String} conf.user
   * @param {String} conf.password
   */
  constructor(conf) {
    const { host, user, password } = conf;
    this.driver = neo4j.driver(host, neo4j.auth.basic(user, password));
  }

  /**
   * @returns {Database}
   */
  static fromEnv() {
    return new Database({
      host: process.env.NEO4J_HOST,
      user: process.env.NEO4J_USER,
      password: process.env.NEO4J_PASS,
    });
  }

  /**
   * @param {String} query
   * @param {Object} [args]
   *
   * @returns {Object}
   */
  async run(query, args) {
    args = args || {};

    console.log('Running:');
    console.log(query);
    console.log('Args:', args);

    const session = this.driver.session();
    const result = await session.run(query, args);
    await session.close();
    return result;
  }

  /**
   * @returns {Promise<void>}
   */
  close() {
    return this.driver.close();
  }
}

/**
 * @class
 */
class Node {
  /** @var {String} valueName */
  static valueName = 'value';

  /**
   * @param {Object} conf A configuration object.
   */
  constructor(conf) {
    const valueName = this.getValueName();
    this[valueName] = conf[valueName];
  }

  /**
   * @returns {Object}
   */
  static model() {
    return {};
  }

  /**
   * @returns {String}
   */
  getValueName() {
    return this.constructor.valueName;
  }

  /**
   * @returns {any}
   */
  getValue() {
    return this[this.getValueName()];
  }

  /**
   * @returns {String}
   */
  static getLabel() {
    let label = '';
    let prototype = this;
    while (prototype) {
      label += `:${prototype.name}`;
      if (prototype === Node) {
        break;
      }
      prototype = Object.getPrototypeOf(prototype);
    }
    return label;
  }

  /**
   * @param {String} label
   *
   * @returns {String}
   */
  static getClassNameFromLabel(label) {
    return label.split(':', 2)[1];
  }

  /**
   * @param {String} [label]
   * @param {typeof Node} cls
   *
   * @returns {Boolean}
   */
  static is(label, cls) {
    if (typeof label !== 'string') {
      cls = label;
      label = this.getLabel();
    }
    const re = new RegExp(`:${cls.name}(:|$)`);
    return re.test(label);
  }

  /**
   * @returns {Object}
   */
  serialize() {
    const valueName = this.getValueName();
    return {
      [valueName]: this[valueName],
    };
  }

  /**
   * @param {Object} conf A configuration object.
   *
   * @returns {Entity}
   */
  static deserialize(conf) {
    return new Entity(conf);
  }
}

/**
 * Creates a function that automatically serializes a node.
 *
 * @param {Node} inst Must be this.
 *
 * @returns {{ () => Object }} The created function.
 */
function makeAutoSerializable(inst) {
  const serialize = inst.serialize;
  return function () {
    const model = inst.constructor.model();
    const conf = serialize ? serialize.call(inst) : {};
    for (const prop in model) {
      // TODO: Implement function makeAutoSerializable
    }
    return conf;
  };
}

/**
 * Creates a function that automatically deserializes a node.
 *
 * @param {typeof Node} cls The node class.
 *
 * @returns {{ (conf: Object) => Node }} The created function.
 */
function makeAutoDeserializable(cls) {
  return function (conf) {
    const model = cls.model();
    for (const prop in model) {
      // TODO: Implement function makeAutoDeserializable
    }
    return new cls(conf);
  };
}

/**
 * @class
 */
class Relationship {
  /**
   * @param {Object} conf A configuration object.
   * @param {typeof Node} conf.target The target node of the relationship.
   * @param {String} [conf.label] The relationship label. Defaults to ':HAS'.
   * @param {Boolean} [conf.optional] True if the relationship is optional.
   * Defaults to false.
   * @param {Boolean} [conf.list] True if the parent node can have multiple
   * instances of the relationship. Defaults to false.
   */
  constructor(conf) {
    conf = Object.assign({
      label: ':HAS',
      optional: false,
      list: false,
    }, conf);

    /** @var {typeof Node} target */
    this.target = conf.target;

    /** @var {String} label */
    this.label = conf.label;

    /** @var {Boolean} optional */
    this.optional = conf.optional;

    /** @var {Boolean} list */
    this.list = conf.list;
  }
}

// FIXME: Make this configurable!
const API_URL = 'http://localhost:3000/api';

/**
 * @class
 */
class Entity extends Node {
  /** @var {String} valueName */
  static valueName = 'uuid';

  /**
   * @param {Object} conf A configuration object.
   * @param {String} [conf.uuid] The UUID of the entity. Use undefined if the
   * entity is not yet in a database. Defaults to undefined.
   */
  constructor(conf) {
    super(conf);

    /** @var {String} uuid The UUID of the entity. */
    this.uuid = conf.uuid;
  }

  /**
   * Saves the entity into a database.
   *
   * @returns {Promise<Entity>}
   */
  async save() {
    return new Promise((resolve, reject) => {
      const url = `${API_URL}/${this.constructor.name.toLowerCase()}/save`;
      const data = { data: this.serialize() };
      rest.post(url, data, (err, res) => {
        if (err) { reject(err); return; }
        // FIXME: Use valueName instead
        this.uuid = res.uuid;
        resolve(this);
      });
    });
  }

  /**
   * Loads an entity from a database.
   *
   * @param {Object} filter
   * @param {String} filter.uuid The UUID of the entity to load.
   *
   * @returns {Promise<Entity>}
   */
  static async load(filter) {
    return new Promise((resolve, reject) => {
      const url = `${API_URL}/${this.name.toLowerCase()}/load?uuid=${filter.uuid}`;
      rest.get(url, (err, res) => {
        if (err) { reject(err); return; }
        resolve(res);
      });
    });
  }

  /**
   * Deletes the entity from a database.
   *
   * @returns {Promise<Number>} Total number of deleted nodes.
   */
  async delete() {
    return new Promise((resolve, reject) => {
      const url = `${API_URL}/${this.constructor.name.toLowerCase()}/delete`;
      const data = { data: this.serialize() };
      rest.delete(url, data, (err, res) => {
        if (err) { reject(err); return; }
        resolve(res);
      });
    });
  }
}

/**
 * @class
 */
class Uuid {
  static REGEX = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

  /**
   * @param {any} val
   *
   * @returns {Boolean}
   */
  static isUuid(val) {
    if (typeof val !== 'string') {
      return false;
    }
    return this.REGEX.test(val);
  }
}

/**
 * @class
 */
class Deferred {
  /**
   * @param {Object} conf A configuration object.
   * @param {typeof Node} conf.class
   * @param {Object} filter
   * @param {String} [filter.uuid]
   * @param {Number} [limit] Defaults to 1. Use undefined for no limit.
   */
  constructor(conf) {
    /** @var {typeof Node} class */
    this.class = conf.class;

    /** @var {Object} filter */
    this.filter = conf.filter;

    /** @var {Number|undefined} limit */
    this.limit = ('limit' in conf) ? conf.limit : 1;
  }

  /**
   * @returns {Object}
   */
  serialize() {
    return {
      class: this.class.name,
      filter: this.filter,
      limit: this.limit,
    };
  }

  /**
   * @param {Object} conf
   *
   * @returns {Deferred}
   */
  static deserialize(conf) {
    return new Deferred(conf);
  }
}

/**
 * @class
 */
class Property extends Node {
  /** @var {Array|undefined} allowed A list of allowed property values. */
  static allowed;

  /**
   * Turns a JS representation of a property into its DB form.
   *
   * @throws {Error} If the the value is not valid.
   */
  static into(val) {
    const allowed = this.allowed;
    if (allowed !== undefined) {
      if (!allowed.includes(val)) {
        throw new Error(`"${val}" is not a valid ${this.name} type!`);
      }
    }
    return val;
  }

  /** Turns a DB representation of a property into its JS form. */
  static from(val) {
    return val;
  }
}

/**
 * @class
 */
class Query {
  constructor(conf) {
    /**
     * @param {Object} conf A configuration object.
     * @param {String} [conf.string] A raw Cypher query string.
     * @param {Object} [conf.args] Arguments for the query.
     */
    this.string = conf.string || '';
    this.args = Object.assign({}, conf.args);

    this.nodeCounter = 0;
    this.nodes = {};

    this.relCounter = 0;
    this.argCounter = 0;
    this.tempCounter = 0;
    this.uuidCounter = 0;

    this.valToArgName = {};

    this.context = [];
  }

  /** @returns {String} */
  addUuid() {
    if (!this.context.includes('uuids')) {
      this.context.push('uuids');
    }
    return `uuids[${this.uuidCounter++}]`;
  }

  /**
   * @returns {String}
   */
  peekNode() {
    return `n${this.nodeCounter + 1}`;
  }

  /**
   * @param {Node} node
   *
   * @returns {String}
   */
  addNode(node) {
    const nodeName = `n${this.nodeCounter++}`;
    this.nodes[nodeName] = node;
    return nodeName;
  }

  /** @returns {String} */
  addRelationship() {
    return `r${this.relCounter++}`;
  }

  /**
   * @param {String|Number} val
   *
   * @returns {String}
   */
  addArgument(val) {
    let argName;
    if (val in this.valToArgName) {
      argName = this.valToArgName[val];
    } else {
      argName = `a${this.argCounter++}`;
      this.valToArgName[val] = argName;
    }
    this.args[argName] = val;
    return ('$' + argName);
  }

  /** @returns {String} */
  addTemp() {
    return `t${this.tempCounter++}`;
  }

  /**
   * @param {String} nodeName The name of the node.
   *
   * @returns {String}
   */
  nodeToString(nodeName) {
    const node = this.nodes[nodeName];
    if (node instanceof Deferred) {
      const a0 = this.addArgument(node.uuid);
      return `(${nodeName}${node.class.getLabel()} {uuid: ${a0}})`;
    }
    if (node instanceof Entity) {
      const a0 = (node.uuid) ? this.addArgument(node.uuid) : this.addUuid();
      return `(${nodeName}${node.constructor.getLabel()} {uuid: ${a0}})`;
    }
    if (node.getValue()) {
      const a0 = this.addArgument(node.getValue());
      return `(${nodeName}${node.constructor.getLabel()} {${node.getValueName()}: ${a0}})`;
    }
    return `(${nodeName}${node.constructor.getLabel()})`;
  }

  /**
   * @param {Database} db
   *
   * @returns {Promise}
   */
  async run(db) {
    let str = '';
    if (this.uuidCounter > 0) {
      str += `CALL apoc.create.uuids(${this.uuidCounter}) YIELD uuid AS uuid\n`
        + 'WITH collect(uuid) AS uuids\n';
    }
    str += this.string;
    return db.run(str, this.args);
  }
}

/**
 * @param {any} values
 *
 * @return {Array}
 */
function toArray(values) {
  if (!Array.isArray(values)) {
    if (values !== undefined) {
      values = [values];
    } else {
      values = [];
    }
  }
  return values;
}

/**
 * @class
 */
class Model {
  /**
   * @param {Object} conf A configuration object.
   * @param {Array<typeof Node>} [conf.classes] A list of Node classes in the
   * model.
   */
  constructor(conf) {
    /**
     * @var {Object} classes
     * @private
     */
    this.classes = {};

    for (const cls of conf.classes || []) {
      this.addClass(cls);
    }
  }

  /**
   * @param {typeof Node} cls
   *
   * @return {Model} Returns self.
   */
  addClass(cls) {
    this.classes[cls.name] = cls;
    return this;
  }

  /**
   * @param {String} name The name of the class.
   *
   * @param {typeof Node|undefined}
   */
  getClass(name) {
    return this.classes[name];
  }

  /**
   * @param {any} conf
   *
   * @returns {Node|any}
   */
  deepDeserialize(conf) {
    if (conf instanceof Node) {
      return conf;
    }

    if (Array.isArray(conf)) {
      return conf.map(v => this.deepDeserialize(v));
    }

    if (conf && (typeof conf === 'object')) {
      const deser = Object.assign({}, conf);

      for (const k in deser) {
        deser[k] = this.deepDeserialize(deser[k]);
      }

      if ('__class' in conf) {
        const cls = conf.__class;

        if (cls === 'Deferred') {
          return new Deferred({
            class: this.getClass(deser.class),
            filter: { uuid: deser.uuid },
            limit: 1,
          });
        }

        const constructor = this.getClass(cls);
        if (constructor !== undefined) {
          return constructor.deserialize(deser);
        }
      }

      return deser;
    }

    return conf;
  }

  /**
   * @param {Entity} entity
   * @param {Database} db
   *
   * @returns {Promise<Entity>}
   */
  async save(entity, db) {
    const query = new Query({});

    const N = query.nodeToString.bind(query);
    const context = () => query.context.join(', ');

    const buildQuery = (node) => {
      const n0 = query.addNode(node);

      if (node instanceof Deferred) {
        query.string += `WITH ${context()}\n`;
        query.string += `MATCH ${N(n0)}\n`;
      } else {
        query.string += `MERGE ${N(n0)}\n`;
      }

      query.context.push(n0);

      const model = (node.constructor.model !== undefined)
        ? node.constructor.model()
        : {};

      for (const propName in model) {
        const rel = model[propName];
        const { target, label } = rel;
        const values = toArray(node[propName]);

        // Delete old connections
        const t0 = query.addTemp();
        query.string += `WITH ${context()}\n`;
        query.string += `OPTIONAL MATCH (${n0})-[${t0}${label}]->(${target.getLabel()}) DELETE ${t0}\n`;

        // Create new connections
        for (let val of values) {
          val = (target.is(Property)) ? new target({ value: val }) : val;
          const p0 = buildQuery(val);
          if (!query.context.includes(p0)) {
            query.context.push(p0);
          }
          query.string += `MERGE (${n0})-[${label}]->(${p0})\n`;
        }
      }

      return n0;
    }

    const n0 = buildQuery(entity);

    query.string += `RETURN ${n0}.uuid AS uuid\n`;

    return query.run(db);
  }

  /**
   * Loads entities matching the filter from a database.
   *
   * @param {typeof Entity} cls The entity class.
   * @param {Object} filter The filter.
   * @param {String} [filter.uuid] The UUID of the entity.
   * @param {Number} [limit] Maximum number of fetched entities. Use undefined
   * for no limit. Defaults to 1.
   * @param {Database} db The database to load the entity from.
   *
   * @returns {Promise<Entity|Entity[]>} The loaded entity or a list of loaded
   * entities if limit is > 1.
   */
  async load(cls, filter, limit, db) {
    if (cls instanceof Deferred) {
      db = filter;
      limit = cls.limit;
      filter = cls.filter;
      cls = cls.class;
    } else if (limit instanceof Database) {
      db = limit;
      limit = 1;
    }

    const query = new Query({});
    let carryWith = [];

    const N = (name, label, props) => {
      let propsStr = '';
      if (props && Object.keys(props).length > 0) {
        propsStr = Object.keys(props).map(k => `${k}: ${props[k]}`).join(', ');
      }
      return `(${name}${label ? label : ''}${propsStr ? ` {${propsStr}}` : ''})`;
    };

    /**
     * @param {typeof Entity} cls
     * @param {Boolean} [isRoot]
     *
     * @returns {String}
     */
    const doLoad = (cls, isRoot) => {
      const n0 = query.addNode();
      const valueName = cls.valueName;

      if (isRoot) {
        let props = {};
        if (filter[valueName] !== undefined) {
          props[valueName] = query.addArgument(filter[valueName]);
        }
        query.string += `MATCH ${N(n0, cls.getLabel(), props)}\n`;
      }

      const model = (cls.model !== undefined) ? cls.model() : {};
      const withProps = [
        `__class: labels(${n0})[0]`,
        `${valueName}: ${n0}.${valueName}`
      ];
      const withLocal = [n0];

      for (const propName in model) {
        const rel = model[propName];
        const val = isRoot ? filter[propName] : undefined;
        const propClass = rel.target;
        const propValueName = propClass.valueName;
        const list = rel.list;
        const optional = rel.optional;

        if (propClass.prototype instanceof Entity
          || propClass.prototype instanceof Property) {
          const n1 = query.addNode();
          const props = {};

          if (val !== undefined) {
            props[propValueName] = query.addArgument(val);
          } else if (optional || list) {
            query.string += 'OPTIONAL ';
          }
          query.string += `MATCH ${N(n0)}-[${rel.label}]->${N(n1, propClass.getLabel(), props)}\n`;

          if (list) {
            withProps.push(`${propName}: collect({ uuid: ${n1}.${propValueName}, class: labels(${n1})[0], __class: "Deferred" })`);
          } else {
            withProps.push(`${propName}: ${n1}.${propValueName}`);
          }
          withLocal.push(n1);
        } else { // Custom Nodes
          const n1 = query.peekNode();

          if (val !== undefined) {
            const arg = query.addArgument(val);
            query.string +=
              `MATCH (${n0})-[${rel.label}]->(${n1}${propClass.getLabel()} {uuid: ${arg}})\n`;
          } else {
            query.string +=
              `OPTIONAL MATCH (${n0})-[${rel.label}]->(${n1}${propClass.getLabel()})\n`;
          }

          carryWith = carryWith.concat(withLocal);
          carryWith = [...new Set(carryWith)];

          const temp1 = doLoad(propClass);

          if (list) {
            const temp2 = query.addTemp();
            query.string += `WITH collect(${temp1}) AS `
              + [temp2].concat(carryWith).join(', ') + '\n';
            withProps.push(`${propName}: ${temp2}`);
          } else {
            withProps.push(`${propName}: ${temp1}`);
          }
        }
      }

      for (const w of withLocal) {
        const index = carryWith.indexOf(w);
        if (index !== -1) {
          carryWith.splice(index, 1);
        }
      }

      const temp = query.addTemp();
      query.string += 'WITH {'
        + withProps.join(', ')
        + '} AS ' + [temp].concat(carryWith).join(', ') + '\n';

      return temp;
    };

    const temp = doLoad(cls, true);
    query.string += `RETURN ${temp} AS data`;
    if (limit !== undefined) {
      query.string += ` LIMIT ${limit}`;
    }

    console.log(query.string);

    // return Promise.resolve(null);

    const res = await query.run(db);

    if (limit === 1) {
      if (res.records.length == 0) {
        return Promise.reject(new Error('No such entity was found!'));
      }
      const conf = res.records[0].get('data');
      return Promise.resolve(this.deepDeserialize(conf));
    }

    return Promise.resolve(res.records.map(r => {
      const conf = r.get('data');
      return this.deepDeserialize(conf);
    }));
  }

  /**
   * Deletes an entity from a database, as well as all nodes without connections.
   *
   * @param {Entity} entity The entity to delete.
   * @param {Database} db The database to delete the entity from.
   *
   * @returns {Promise<Number>} Number of deleted nodes in total.
   */
  async delete(entity, db) {
    // FIXME: Delete child entities!
    const query = 'MATCH (n0) WHERE n0.uuid = $uuid DETACH DELETE n0\n'
      + 'MATCH (n1) WHERE NOT (n1)--() DELETE (n1)\n'
      + 'RETURN count(n0) + count(n1) AS count';
    const res = await db.run(query, { uuid: entity.uuid });
    return Promise.resolve(res.records[0].get('count'));
  }
}

module.exports = {
  Database,
  Deferred,
  Entity,
  makeAutoDeserializable,
  makeAutoSerializable,
  Model,
  Node,
  Property,
  Relationship,
  Uuid,
};
