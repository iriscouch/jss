#!/usr/bin/env node
// The jss command-line interface.
//

var sys = require('sys')
  , jss = require('jss')
  ;

var usage = 'jss <test predicate> [result expression]';
var argv = require('optimist').usage(usage).argv
  , predicate = argv._[0]
  , expression = argv._[1]
  ;

var test = new Function('obj', 'with (obj) { return (' + predicate + ') }');
var format = function(obj) { return JSON.stringify(obj) };

if(!predicate) {
  console.log(usage);
  process.exit(1);
}

if(expression) {
  var getter = new Function('obj, $, tab, kv, require, util', 'with (obj) { return (' + expression + ') }');

  function tab_separate() {
    return Array.prototype.slice.apply(arguments).join("\t");
  }

  function keyval_line(key, val) {
    if(typeof key !== 'string')
      throw new Error("Bad key for keyval: " + key);

    return JSON.stringify(key) + ":" + JSON.stringify(val);
  }

  format = function(obj, test_result) {
    var result = getter.apply(obj, [obj, test_result, tab_separate, keyval_line, require, require('util')]);
    if(typeof result === "object")
      result = JSON.stringify(result);
    return "" + result;
  }
}

var stream = new jss.Stream();
stream.test = test;
stream.format = format;
stream.in = process.openStdin();
stream.out = process.stdout;

; ['pre', 'suf', 'head', 'tail'].forEach(function(arg) {
  if(argv[arg])
    stream[arg] = argv[arg];
})

stream.pump();
