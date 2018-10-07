<template>
  <div>
    <span class='tree-view-item-key'>{{keyString}}</span>
    <input v-if='modifiable' class='tree-view-item-value' :class='getValueType(data)' v-model='valueString' @keyup.enter='onUpdateData' @blur='onUpdateData'>
    <span v-else class='tree-view-item-value' :class='getValueType(data)'>{{ valueFormed }}</span>
    <span v-show='error'>{{ error }}</span>
  </div>
</template>


<script>
import _ from 'lodash';

export default {
  name: 'tree-view-item',
  props: ['data', 'modifiable', 'key-string'],
  data() {
    return {
      valueString: this.data && this.data.toString(),
      error: false,
    };
  },
  computed: {
    valueFormed() {
      return this.getValue(this.data);
    },
  },
  watch: {
    valueFormed(val) {
      this.$set(this, 'valueString', _.isString(val) ? val.replace(/^[']+|[']+$/g, '') : val);
    },
  },
  methods: {
    onUpdateData() {
      try {
        const v = this.typedValue(this.valueString);
        this.error = false;
        this.$emit('change-data', [], v);
      } catch (err) {
        this.error = err;
      }
    },
    typedValue(v) {
      if (v === '') throw new Error('empty');

      const dataType = this.getValueType(this.data, '');

      switch (dataType) {
        case 'number':
          if (_.isNaN(_.toNumber(v))) {
            throw new Error('only number');
          }
          return _.toNumber(v);
        case 'boolean':
          if (v.toLowerCase() === 'true') { return true; }
          if (v.toLowerCase() === 'false') { return false; }
          throw new Error('true or false');
        case 'string':
        default:
          return v;
      }
    },
    getValue(value) {
      if (_.isNumber(value)) {
        return value;
      }
      if (_.isNull(value)) {
        return 'null';
      }
      if (_.isString(value)) {
        return `'${value}'`;
      }
      return value;
    },
    getValueType(value, prefix = 'tree-view-item-value-') {
      if (_.isNumber(value)) {
        return `${prefix}number`;
      }
      if (_.isFunction(value)) {
        return `${prefix}function`;
      }
      if (_.isBoolean(value)) {
        return `${prefix}boolean`;
      }
      if (_.isNull(value)) {
        return `${prefix}null`;
      }
      if (_.isString(value)) {
        return `${prefix}string`;
      }
      return `${prefix}unknown`;
    },
  },
};
</script>
