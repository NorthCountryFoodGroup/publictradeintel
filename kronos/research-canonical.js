"use strict";

const CANONICALIZATION_VERSION = "KRONOS_JCS_STRICT_V1";
function canonicalError(message) { return Object.assign(new Error(message), { code: "invalid_canonical_value" }); }
// RFC 8785's ECMAScript serialization and UTF-16 key ordering, restricted to
// unambiguous plain JSON data. Never call toJSON or user-provided accessors.
function canonicalize(value) {
  const ancestors = new Set();
  function encode(item, depth) {
    if (depth > 128) throw canonicalError("Maximum nesting exceeded.");
    if (item === null) return "null";
    if (typeof item === "string") {
      if (!item.isWellFormed()) throw canonicalError("Unpaired Unicode surrogate.");
      return JSON.stringify(item);
    }
    if (typeof item === "boolean") return item ? "true" : "false";
    if (typeof item === "number") {
      if (!Number.isFinite(item) || (Number.isInteger(item) && !Number.isSafeInteger(item))) throw canonicalError("Number is not finite or safely representable.");
      return JSON.stringify(item);
    }
    if (typeof item !== "object") throw canonicalError("Unsupported JSON type.");
    if (ancestors.has(item)) throw canonicalError("Cyclic data.");
    const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
    if (!array && prototype !== Object.prototype && prototype !== null) throw canonicalError("Expected plain JSON object.");
    const descriptors = Object.getOwnPropertyDescriptors(item);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (array && key === "length") continue;
      if (typeof key !== "string" || !key.isWellFormed() || !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], "value")) throw canonicalError("Unsupported property.");
    }
    ancestors.add(item);
    let result;
    if (array) {
      if (Object.keys(descriptors).length !== item.length + 1) throw canonicalError("Sparse or decorated array.");
      const values = [];
      for (let i = 0; i < item.length; i++) {
        if (!Object.hasOwn(descriptors, i)) throw canonicalError("Sparse array.");
        values.push(encode(descriptors[i].value, depth + 1));
      }
      result = `[${values.join(",")}]`;
    } else {
      result = `{${Object.keys(descriptors).sort().map(key => `${JSON.stringify(key)}:${encode(descriptors[key].value, depth + 1)}`).join(",")}}`;
    }
    ancestors.delete(item);
    return result;
  }
  return encode(value, 0);
}
module.exports = Object.freeze({ CANONICALIZATION_VERSION, canonicalize });
